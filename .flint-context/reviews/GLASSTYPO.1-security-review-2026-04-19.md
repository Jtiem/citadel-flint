# GLASSTYPO.1 Security Review — 2026-04-19

**Reviewer:** flint-security-reviewer
**Phase:** GLASSTYPO.1 (rev 3) — Glass Interaction Schema + Figma-Rhythm Type Scale + Primitive Vocabulary
**Round:** 1
**Verdict (derived):** FIX-FORWARD (0 blocking, 1 warning, 1 suggestion)

---

## Threat Model (scope-adjusted)

This is a pure renderer-side refactor. No new IPC channels, no new preload surface, no main-process changes, no MCP tools, no SQLite access. The Flint process boundary (Node ↔ preload ↔ React) is untouched. The residual attack surface is limited to:

1. Unsafe HTML rendering inside the new primitives (`MetadataTooltip` renders `ReactNode`)
2. User-controllable data flowing into CSS custom properties (`color-mix` expressions, inline `style=`)
3. `javascript:` URL injection through any primitive that renders an anchor tag
4. Process-boundary regressions (Node modules accidentally imported into `src/`)
5. Regex-on-source patterns (Commandment 13)
6. Orphaned `Accordion` imports after deletion causing white-screen (availability, not classic "security", but a renderer DoS vector)

## Adversarial Tests Performed

- **`dangerouslySetInnerHTML` sweep** across `src/components/ui/primitives/`, `src/components/ui/governance/`, `src/components/inspector/` — 0 matches.
- **`eval|new Function|innerHTML=|document.write|javascript:` sweep** across the same scope — 0 matches.
- **Node-module import sweep** (`fs|path|child_process|electron|os|crypto`) across the canary scope — 0 matches. Process boundary intact.
- **`color-mix()` call-site audit** — 2 occurrences, both in `Section.tsx` lines 170–171 with **literal string arguments** only. No string interpolation into CSS expressions. Safe.
- **Inline `style=` interpolation audit** — no `${...}` template expressions feeding into `style`. Every style value is either a literal or a bound variant from a frozen `Record<Variant, Config>`.
- **Accordion deletion residue** — `rg -n "import.*Accordion.*from.*inspector/primitives"` returns 0 matches. The three hits in the old codebase now live in comments/docs only. No broken imports.
- **`<a href>` audit** in new primitives — 1 site: `FooterActionBar.tsx:73`, href is a raw string prop with no scheme validation.

## Findings

### WARN-1 — `FooterLink.href` accepts unvalidated URL strings (`javascript:` latent risk)

- **Location:** `src/components/ui/primitives/FooterActionBar.tsx:34–82`
- **Severity:** warning
- **Commandment:** 5 (a11y/safety compiler error) and defense-in-depth
- **Observed:** `FooterLinkProps.href?: string` is passed directly to `<a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>`. There is no allowlist of URL schemes. A caller that supplies `href="javascript:alert(1)"` would get a clickable, same-origin JS-URL link. `rel="noopener"` is only attached when `external` is true, so a same-tab `javascript:` payload would execute in the Glass renderer origin — which has access to `window.flintAPI` and therefore the IPC bridge.
- **Rationale:** Today no caller passes user-supplied data into `href` — the one planned use is static policy-settings and manage-rules destinations. But `FooterLink` is a primitive slated for reuse; a future caller (e.g., an MCP-provided link, a registry entry's `docsUrl`) could flow untrusted data through this prop. Once the primitive ships, auditing every call site forever is strictly harder than blocking the scheme at the primitive.
- **Proposed Fix:** Validate the href scheme inside `FooterLink`:
  ```ts
  const SAFE_SCHEMES = /^(https?:|mailto:|\/|#)/i;
  const safeHref = href && SAFE_SCHEMES.test(href) ? href : undefined;
  ```
  Also set `rel="noopener noreferrer"` unconditionally on external-capable anchors, not just when `external` is true.
- **Scope:** one-file
- **Status:** open

### SUG-1 — `StatBadge` and `Section` accept arbitrary `ReactNode` without documented trust expectations

- **Location:** `src/components/ui/primitives/StatBadge.tsx:29`, `src/components/ui/primitives/Section.tsx:67`, `src/components/ui/primitives/MetadataTooltip.tsx:39`
- **Severity:** suggestion
- **Commandment:** N/A (React intrinsically escapes children; this is documentation, not a vulnerability)
- **Observed:** Three primitives accept `children: React.ReactNode`. React escapes string children by default, and none of the primitives serialize children to HTML strings — so there is no XSS path. However, the component docblocks do not state "children render as escaped text; do not pass pre-rendered HTML strings here." A future contributor using `MetadataTooltip content={someMarkdownRendered}` with a homegrown markdown→HTML helper could accidentally introduce `dangerouslySetInnerHTML` into a downstream wrapper.
- **Rationale:** Contract hygiene. The contract states "MetadataTooltip receives content: ReactNode" but does not forbid HTML-bearing wrappers. Documenting the trust boundary once at the primitive is cheaper than catching every regression in code review.
- **Proposed Fix:** Add a one-line JSDoc to each primitive's `children`/`content` prop: *"Rendered as React children (auto-escaped). Do not wrap with dangerouslySetInnerHTML."*
- **Scope:** one-line (per primitive)
- **Status:** open

## Verified Controls (rubric pass)

- **R1 — No `dangerouslySetInnerHTML` in canary scope.** PASS.
- **R2 — No `eval`, `new Function`, `document.write`, or string-to-DOM patterns in canary scope.** PASS.
- **R3 — No Node.js module imports (`fs`, `path`, `child_process`, `electron`, `os`, `crypto`) in any file touched.** PASS. Process boundary intact (Commandment 14).
- **R4 — `color-mix()` expressions use literal strings only; no user input flows into CSS tokens.** PASS. Section.tsx:170–171 uses static literals (`var(--text-primary) 3%`, `var(--text-accent) 40%`).
- **R5 — Inline `style=` props contain no `${...}` interpolation of untrusted data.** PASS. All style values are literals or bound from frozen variant tables.
- **R6 — No regex-on-source patterns in canary scope.** PASS. `PropertyRow.tsx:30` contains a regex (`NUMERIC_RE`), but it matches against a **rendered value** (a prop of type `React.ReactNode` restricted to string), not against source code. Commandment 13 forbids regex on source code; this does not apply.
- **R7 — `Accordion` deletion is complete and consistent.** PASS. No remaining imports of `Accordion` from `inspector/primitives`. The one `_settings-test.tsx` hit imports from `primeng/accordion` (a different, vendored component — out of scope and unrelated).
- **R8 — CSP-relevant portal/teleport patterns.** PASS. `MetadataTooltip` renders the tooltip body as a sibling `<span>` via absolute positioning — no `createPortal` call, no `document.body` append. Content stays inside the primitive's subtree; CSP does not need to allow detached nodes.
- **R9 — Event handler safety (onClick / onFocus / onBlur / onMouseEnter).** PASS. All handlers are bound callbacks from `useCallback` or inline setState calls. No dynamic function composition, no `new Function(handlerString)`, no `javascript:` URL construction.
- **R10 — Tooltip portal/CSP surface.** PASS (see R8). Tooltip is inline, not portaled; no CSP implications.
- **R11 — No `dangerouslySetInnerHTML` introduced in `GovernanceDashboard.tsx` or `PropertiesPanel.tsx` refactors.** PASS.

## Scope Coverage

**Reviewed:**
- `src/components/ui/primitives/` (all 6 primitives + `__tests__`)
- `src/components/ui/GovernanceDashboard.tsx`
- `src/components/ui/governance/` (directory-level grep)
- `src/components/ui/PropertiesPanel.tsx`
- `src/components/inspector/` (all 4 migrated files + `primitives.tsx`)
- `src/index.css` (token block — no security implications; literal CSS only)

**Skipped (with reason):**
- `electron/**` — contract declares no Electron changes, verified no diff against canary scope.
- `server/**`, `flint-mcp/**`, `shared/**` — out of scope per contract non-goals.
- Panels outside the canary (Tokens, Assets, StatusBar, ExportModal, ComponentPanel, Command Palette) — contract non-goal #2.

## Recommendations (priority order)

1. **Land WARN-1** before the primitive is reused beyond the two canary panels. Cheapest when the surface is still narrow.
2. **Land SUG-1 docblocks** alongside WARN-1 — same commit, same reviewer attention.
3. **No other action required.** Security posture for this phase is clean.

## Sibling artifact

`.flint-context/reviews/GLASSTYPO.1-security-review-2026-04-19.review.ts`
