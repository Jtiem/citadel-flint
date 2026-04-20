# Design Spec as Contract — A Guide for UX Designers

**Purpose:** A pragmatic guide for writing design specs that engineering can build against in parallel, without waiting on you for every question.

**Who this is for:** UX designers handing specs to a frontend + backend team. Especially useful when the team is working with AI coding agents that need unambiguous inputs.

**Why this exists:** Traditional design specs (Figma + a doc) leave too much interpretation to engineering. "Make it feel fast" becomes "500ms." "Handle errors gracefully" becomes a crashed UI. Contract-first specs close those gaps by making the design decisions falsifiable.

---

## 1. The Mental Model: Design the Seam

The best thing you can do for a frontend/backend team is define **the seam between them** — the shape of data flowing across. Once the seam is agreed, the two sides can build in parallel without stepping on each other.

```
 ┌──────────────┐           ┌──────────────┐
 │   Frontend   │ ── seam ──│   Backend    │
 │ (what user   │           │ (what system │
 │  sees/does)  │           │  stores/does)│
 └──────────────┘           └──────────────┘
        │                           │
        └── design spec covers ─────┘
             BOTH sides + the seam
```

**You own:** the experience — states, behavior, copy, accessibility, error recovery.
**Engineering owns:** how to deliver it — storage, APIs, performance implementation.
**You agree on together:** the typed data contract — what flows across the seam.

Once you learn to think this way, "frontend vs backend spec" stops being the right question. There's one spec, structured in layers.

---

## 2. The Ten Layers of a Good Spec

A contract-first spec has ten sections. You don't need every section for every feature — small features use a subset. But the order matters.

| # | Layer | Who drafts | What it answers |
|---|-------|-----------|-----------------|
| 1 | **Summary** | PM + UX | What can the user do after this ships, and why? |
| 2 | **Non-goals** | PM + UX | What are we explicitly NOT building? |
| 3 | **Type Contracts** | Dev (UX + Content review) | What data shapes flow across the seam? |
| 4 | **API Contracts** | Dev (UX reviews) | What endpoints exist, who calls them, what comes back? |
| 5 | **Component Contracts** | UX | What UI components exist, what props, what events? |
| 6 | **Copy Contracts** | Content Designer | Every user-facing string, keyed to a state or surface |
| 7 | **States** | UX (Content owns the copy column) | Every visual state, its trigger, and the copy it shows |
| 8 | **Invariants** | UX + Dev | Measurable rules — "must happen" and "must not happen" |
| 9 | **Test Boundaries** | UX + Content | Given / when / then — how do we know it works? |
| 10 | **Impact Map** | Dev | Which files change, who owns each |

The discipline: **every section should be falsifiable.** If a reviewer can't point at a line and say "prove it," rewrite it.

---

## 3. The Template (Annotated)

Copy this as a starting point. Delete sections that don't apply. Fill in plain English first, then tighten.

### Header

```markdown
# FEATURE.1 — [short feature name]

Status: DRAFT | APPROVED
Owner: [your name]
Date: YYYY-MM-DD
Primary audience: [end-user | admin | developer | internal]
```

**Why it matters:** Status and owner make the doc a living artifact, not a ghost. "Primary audience" forces you to pick — features that claim "everyone" usually help no one.

### 1. Summary

One paragraph. State it as: **"[User] can now [action] which they couldn't before."**

> Example: "Signed-in customers can favorite items from the catalog list. Favorites persist across sessions and appear in a Favorites filter on the list page."

If you can't state it this cleanly, the feature isn't scoped yet.

### 2. Non-goals

A bulleted list of what you're **not** doing. Be generous — this is how you prevent scope creep during implementation.

> Example:
> - No folders or tags on favorites (future phase)
> - No cross-device sync beyond the user's account
> - No bulk favorite/unfavorite action
> - No shareable favorites lists

**Rule of thumb:** if you can imagine a stakeholder asking "but what about X?" — put X here with a reason, or acknowledge it's out of scope.

### 3. Type Contracts (the seam)

TypeScript-style interfaces, but even pseudocode works. These are the data shapes that live on both sides of the seam.

```ts
interface Favorite {
  itemId: string
  userId: string
  favoritedAt: string  // ISO 8601
}

type FavoriteToggleResult =
  | { status: 'favorited'; favorite: Favorite }
  | { status: 'unfavorited'; itemId: string }
  | { status: 'auth-required' }
  | { status: 'error'; code: 'rate-limited' | 'network' | 'unknown'; message: string }
```

**Why this matters for a UX designer:** the discriminated union (the `status` field) is how you force engineering to surface every state you designed. If the API returns one of these four `status` values, you know your SignInPrompt, success animation, and error toast all have a trigger.

Write these with engineering, but you should understand every shape. If you don't, the spec isn't ready.

### 4. API Contracts

A table of endpoints. Engineering drafts, you review — specifically the response shapes, because they drive your states.

| Endpoint | Method | Request | Response | Auth |
|---|---|---|---|---|
| `/api/favorites/:itemId` | `POST` | `{}` | `FavoriteToggleResult` | required |
| `/api/favorites/:itemId` | `DELETE` | `{}` | `FavoriteToggleResult` | required |
| `/api/favorites` | `GET` | — | `Favorite[]` | required |

**What to check as a designer:** does every response shape map to a state you designed? If the API can return `rate-limited` but you didn't design a rate-limit state, that's a gap.

### 5. Component Contracts

The UI components you're introducing. Name them, list props, list events.

| Component | Props | Emits |
|---|---|---|
| `FavoriteButton` | `{ itemId, isFavorited, onToggle }` | `onToggle(itemId)` |
| `ItemCard` | `{ item, isFavorited }` | — |
| `FavoritesFilter` | `{ active, onChange }` | `onChange(active)` |
| `SignInPrompt` | `{ reason: 'favorite' }` | — |

**Discipline:** a component's props are its contract with the rest of the app. The fewer props, the more reusable. If you see a component with 12 props, it's doing too much — split it.

### 6. Copy Contracts

Every user-facing string, keyed to a state or surface. This is the Content Designer's primary artifact. It lives in the spec, not in a separate doc, because copy is inseparable from state.

| Key | Surface | String | Notes |
|---|---|---|---|
| `favorite.button.default.aria` | FavoriteButton aria-label (default) | "Save for later" | verb, present tense |
| `favorite.button.favorited.aria` | FavoriteButton aria-label (favorited) | "Saved. Remove from favorites" | confirms state + next action |
| `favorite.toast.error.network` | Error toast (network) | "Couldn't save. Check your connection and try again." | specific cause + recovery |
| `favorite.toast.error.rate-limited` | Error toast (rate limit) | "Slow down — try again in a moment." | friendly, no jargon |
| `favorite.signin.title` | SignInPrompt title | "Sign in to save favorites" | value-first |
| `favorite.signin.cta` | SignInPrompt button | "Sign in" | imperative, 2 words max |
| `favorite.filter.empty.title` | Empty state (no favorites) | "No favorites yet" | neutral tone |
| `favorite.filter.empty.body` | Empty state body | "Tap the heart on any item to save it here." | teaches the action |
| `favorite.filter.empty.cta` | Empty state CTA | "Browse catalog" | imperative |

**Why this matters:**

- **Localization becomes a reflow, not a rewrite.** Keys are stable; strings can change per locale.
- **Content reviews happen on a table, not screenshots.** Reviewers can scan all strings in one pass.
- **Claude Code reads these verbatim.** If the key exists in the spec, the agent uses that string. If you leave it implicit, the agent invents something — usually something wrong.

**Discipline:** every state in Section 7 must have a copy key. If a state renders text and the key isn't here, Content Design hasn't finished.

### 7. States

Frame-by-frame breakdown. This is where your Figma turns into text the team can build from. The copy column points at keys from Section 6.

| State | Trigger | UI | Copy keys |
| --- | --- | --- | --- |
| `default` | not favorited, authed | outline heart icon | `favorite.button.default.aria` |
| `favorited` | favorited, authed | filled heart + 200ms pulse | `favorite.button.favorited.aria` |
| `loading` | toggle in flight | heart fades to 60% opacity | — |
| `auth-required` | unauthed click | SignInPrompt modal over page | `favorite.signin.title`, `favorite.signin.cta` |
| `error-network` | network failure | toast (4s auto-dismiss) | `favorite.toast.error.network` |
| `error-rate-limit` | 429 from server | toast (4s auto-dismiss) | `favorite.toast.error.rate-limited` |
| `filter-empty` | filter on, no favorites | empty state panel | `favorite.filter.empty.*` |

**Every state needs a trigger.** If you can't say what causes a state, engineering will guess — badly.

**Include the error states.** Most spec failures happen here. Designers draw the happy path; engineering ships the sad path. Spec the sad path yourself.

**Cross-check:** count states and count copy keys. Every state that renders text should reference at least one key.

### 7. Invariants

Measurable rules. No adjectives. Either `< N` or `= 0` or `≥ P%`.

| Name | Rule | How we measure |
|---|---|---|
| toggle-optimistic-latency | UI reflects new state in `< 16ms` of click | timing test around click |
| auth-required-zero-write | unauthed click triggers `= 0` API calls | mocked fetch spy |
| error-retryable | after error, next click triggers a new API call | hook test |
| dedupe-concurrent | rapid double-click triggers `= 1` network call | debounce test |

**Why this is powerful:** it turns "feels fast" into something QA can actually check. It also catches design mistakes early — if engineering can't measure it, you haven't designed it clearly enough.

A good invariant has: a name, a threshold (with operator), and a harness that proves it.

### 8. Test Boundaries

`given / when / then` — one sentence each. These are the sentences QA will write tests from.

- **favorite happy path** — given authed user, not favorited; when clicked; then heart fills, POST fires once, store updates on 200.
- **unfavorite** — given favorited; when clicked; then heart empties, DELETE fires, entry removed from store.
- **auth-required** — given unauthed; when clicked; then SignInPrompt shows, zero API calls.
- **error rollback** — given POST rejects; then heart reverts to unfavorited, toast appears.
- **filter toggles list** — given favorites exist; when filter toggled; then list shows only favorited items.
- **filter empty state** — given no favorites; when filter toggled; then empty state shows with CTA to browse.

**Rule:** if a state exists in your States table but doesn't have a test boundary, the feature will ship broken in that state. Count them and match them.

### 9. Impact Map

Files that change, with owners. Engineering drafts this. You don't need to understand the file paths — you're looking at the **owner** column to see if the team has the right people.

| File | Owner | Change |
|---|---|---|
| `components/FavoriteButton.tsx` | frontend | CREATE |
| `components/FavoritesFilter.tsx` | frontend | CREATE |
| `hooks/useFavorites.ts` | frontend | CREATE |
| `api/favorites.ts` | backend | CREATE |
| `db/migrations/001_favorites.sql` | backend | CREATE |
| `types/favorites.ts` | shared | CREATE |

If one person owns every row, you don't have parallel work — you have a queue. That's a red flag for anything bigger than a week of work.

---

## 4. How to Run a Contract-First Session with Your Team

A contract-first spec is not something you write alone in a room and drop over the wall. It's a collaborative artifact. Here's the cadence that works for a 4-person team (PM + Content Designer + UX Designer + Developer with Claude Code).

### Session 1: PM + UX kickoff (45 minutes)

Draft Sections 1 and 2 — Summary and Non-goals. The PM owns the "why it matters" and success criteria. UX presses for tight scoping.

**Output:** a one-pager that answers: what user, what action, what NOT to build. If Content and Dev can't read this and understand the feature in 90 seconds, shrink it.

### Session 2: UX solo (60 minutes)

Draft Section 5 (Component Contracts) and a first pass at Section 7 (States) — every state, every trigger, copy keys left as placeholders.

**Output:** Figma + markdown skeleton of components and states.

### Session 3: UX + Content Designer (45 minutes)

Content fills Section 6 (Copy Contracts) against your states table. UX cross-checks: every state that renders text references a key; every key renders somewhere.

**Output:** copy table complete, states table's "copy keys" column fully populated.

### Session 4: UX + Developer (60 minutes)

Developer drafts Sections 3, 4, 10 in real time — Type Contracts, API Contracts, Impact Map.

**Your job in this session:** for every response shape they write, check that you have a state for it. For every state you designed, check that there's a data shape that can trigger it. Content Designer reviews async — specifically whether backend-returned strings (error messages from the server) need to be overridden in the Copy Contracts layer.

**Output:** spec complete except Invariants and Test Boundaries.

### Session 5: UX + Dev (30 minutes)

Write Section 8 (Invariants) and Section 9 (Test Boundaries) together. You bring the "what must be true" statements; Dev translates them into measurable thresholds.

### Session 6: Full team review (30 minutes)

PM, Content, UX, Dev, and Claude Code (yes — Dev pulls the spec into a Claude Code session and asks it to flag gaps).

Read the whole doc aloud. Anyone can veto a section that isn't falsifiable. Common vetoes:

- "The error state says 'handle gracefully' — handle how?"
- "The invariant says 'fast' — how fast?"
- "There's no test boundary for the rate-limit state."
- Claude Code: "Section 6 references key `favorite.toast.error.rate-limited` but Section 7 doesn't have a `rate-limited` state."

Fix in the room. Don't schedule a follow-up.

### After approval

The spec becomes the binding artifact. Engineering builds against it in parallel. If a question comes up during implementation, the answer is either:

1. **In the spec** — reread it.
2. **Not in the spec, but implied** — update the spec, then answer.
3. **Not in the spec and not obvious** — you have a gap. Fix the spec before the code.

The spec is never "done" — it's the current agreement. When something changes, the spec changes first, code second.

---

## 5. Common Pitfalls (and How to Avoid Them)

**Pitfall: "The design is in Figma, the spec is supplementary."**
Fix: flip it. The spec is the source of truth for behavior. Figma is the source of truth for pixels. They reference each other but neither is supplementary.

**Pitfall: Missing error states.**
Fix: for every API call in your spec, there are at least three error states — network failure, permission denied, and "I don't know what went wrong." Design all three.

**Pitfall: Invariants with adjectives.**
Fix: "fast" → "< 200ms." "Reasonable" → "≤ 3 concurrent requests." "Accessible" → "passes axe-core on these rules: [list]." Force yourself to pick a number or a rule. If you can't, ask.

**Pitfall: A spec that only covers the happy path.**
Fix: if your States table has one state (`success`), you haven't finished designing. Count: a typical feature has 4–8 states. If yours has 1–2, you're missing something.

**Pitfall: Scope creep during implementation.**
Fix: that's what Non-goals are for. When engineering says "should we also add X?" — check if X is listed as a Non-goal. If it is, defer. If it isn't, decide whether to add it to scope (updating the spec first) or add it to Non-goals.

**Pitfall: Type Contracts written only by engineering.**
Fix: you don't need to write TypeScript, but you need to read every shape and confirm it maps to a state you designed. A response shape you can't visualize is a state you haven't designed.

**Pitfall: The spec drifts after launch.**
Fix: treat the spec like a tombstone — once shipped, it records what shipped. If you change the feature later, write a new spec version (`FAVORITES.2`) that references the old one. Don't edit history.

---

## 6. Pre-Handoff Checklist

Before you hand a spec to the team, check every row. If any fail, fix before handing off.

- [ ] Summary states what the user can do after this ships, in one sentence.
- [ ] Non-goals lists at least 3 things this feature deliberately does NOT do.
- [ ] Every API response shape has a matching UI state.
- [ ] Every UI state has a specific trigger (not "various errors").
- [ ] Every error is designed, not just "show a toast."
- [ ] Every invariant has an operator (`<`, `=`, `≥`, etc.) and a concrete number.
- [ ] Every state has at least one test boundary.
- [ ] Impact Map has more than one owner (otherwise you can't parallelize).
- [ ] A senior engineer has read the Type Contracts and signed off.
- [ ] The spec is under 5 pages. (Longer means you're either in scope creep or designing too many features at once.)

---

## 7. A Note on Scale

This framework scales up and down.

**Tiny feature (1 day):** Summary + States + 2 Test Boundaries. Skip the rest. 20 lines of markdown.

**Medium feature (1 week):** The full template. 2–4 pages.

**Big feature (>1 week):** Split it. A feature that needs 10 pages of spec is actually 3 features that need 3 pages each. Use the Non-goals of each one to explicitly defer the others.

The discipline isn't "always write all 9 sections." It's "pick the right sections for the scope, and make every section falsifiable."

---

## 8. Why This Works

The traditional model of design spec handoff has a failure mode: the spec is written in designer-speak, engineering translates it into their own mental model, and the gap between the two is where bugs live.

Contract-first specs close that gap by:

1. **Making the seam explicit.** Both sides agree on data shapes before anyone writes code.
2. **Making behavior falsifiable.** Every claim in the spec can be proven true or false.
3. **Making error paths first-class.** The sad path is specced, not discovered.
4. **Enabling parallel work.** With a shared contract, frontend and backend build simultaneously without blocking each other.
5. **Creating a tombstone.** When the feature ships, the spec records what shipped — not what we hoped for.

The investment is real — a contract-first spec takes roughly 2x the time of a traditional spec. But implementation takes roughly half the time, because the team isn't guessing.

Net: you spend less total time, and you ship what you designed.

---

## 9. For Your SDD Pilot (PM + Content Designer + UX Designer + Developer + Claude Code)

This is the team shape you're piloting. Here's how the roles map to the ten layers, and how Claude Code fits in as a fifth team member.

### Role × Layer Matrix

| Layer | PM | Content | UX (you) | Developer | Claude Code |
| --- | --- | --- | --- | --- | --- |
| 1. Summary | **owns** | reviews | drafts with PM | reviews | — |
| 2. Non-goals | **owns** | reviews | drafts with PM | reviews | — |
| 3. Type Contracts | reviews | — | reviews shapes | **owns** | drafts from Sections 5–7 |
| 4. API Contracts | reviews | — | reviews shapes | **owns** | drafts from Section 3 |
| 5. Component Contracts | reviews | — | **owns** | reviews feasibility | — |
| 6. Copy Contracts | reviews voice | **owns** | cross-checks against states | reviews technical strings | surfaces missing keys |
| 7. States | reviews | owns copy column | **owns** | reviews feasibility | surfaces state/copy gaps |
| 8. Invariants | reviews | — | **owns** with Dev | **owns** with UX | proposes thresholds from similar features |
| 9. Test Boundaries | reviews | reviews copy assertions | **owns** | reviews | drafts `it.todo` scaffolds |
| 10. Impact Map | reviews | — | reviews owner column | **owns** | — |

**"Owns"** = drafts first, has final say, and updates the section when it changes.
**"Reviews"** = signs off before the spec is approved, can veto specific lines.
**"Drafts"** = writes a first pass that the owner edits.

### What Each Role Brings to a Spec Review

**PM:** Did we scope it right? What's the success metric? Is this worth the effort?
**Content Designer:** Does every user-facing string serve the voice? Are error messages recoverable? Is the label-to-state mapping complete?
**UX Designer (you):** Does every state have a trigger and copy? Are invariants falsifiable? Does the Impact Map span more than one owner?
**Developer:** Are Type Contracts compilable? Does the API shape support every state? What's the maintenance cost of this Impact Map?
**Claude Code:** Flag internal inconsistencies. Propose invariants based on similar shipped features. Generate `it.todo` scaffolds from Test Boundaries. Spot copy keys that aren't referenced from any state (and vice versa).

### How to Use Claude Code in the Spec Phase (Not Just the Build Phase)

Most teams bring the agent in during implementation. Your pilot will go better if you bring it in during spec drafting. Three specific prompts that pay off:

**1. Gap hunter (after Section 7 is drafted):**

> "Read Sections 5, 6, and 7 of this spec. List every state that references a copy key not present in Section 6. List every copy key in Section 6 not referenced from Section 7. List every component in Section 5 whose states are not fully enumerated in Section 7."

Claude is excellent at this because it's literal cross-referencing — exactly where humans drift.

**2. Invariant proposer (after Section 7 is drafted, before Section 8):**

> "Given the states in Section 7 and the API in Section 4, propose 5 falsifiable invariants with measurable thresholds. Flag any state that has no obvious invariant — those are likely underspecified."

**3. Test Boundary scaffolder (after Section 8 is drafted):**

> "For every state in Section 7 and every invariant in Section 8, write a `given / when / then` test boundary. Format as a bulleted list matching the style of the rest of Section 9."

### One Discipline Specific to This Team Shape

With one developer + Claude Code, the developer is a bottleneck on Sections 3, 4, and 10 — they draft alone. Before running Session 4, give the developer the spec up through Section 7 **and tell them to spend 20 minutes with Claude Code drafting Sections 3, 4, and 10 asynchronously.** They arrive at Session 4 with a draft to critique rather than a blank page to fill.

This one change cuts Session 4 from 60 minutes to ~30 and produces better contracts, because Claude Code is stricter about shape consistency than most humans under time pressure.

### What NOT to Ask Claude Code to Do in the Spec Phase

- Don't ask it to draft Section 1 (Summary) or Section 2 (Non-goals). Those are human decisions about what matters and what doesn't. The agent will happily draft a plausible summary that isn't actually what your PM wants.
- Don't ask it to own copy. Content Designers write better microcopy than any model in 2026. Claude Code can suggest, but the Content Designer picks.
- Don't ask it to review the spec holistically ("is this a good spec?"). Ask it to do narrow cross-checks. Narrow questions → reliable answers.

---

## 10. One More Thing

If your team uses AI coding agents (Claude Code, Cursor, Copilot Workspace), this framework becomes even more valuable. Agents are literal — they build exactly what you specify, nothing more. A vague spec produces vague code. A falsifiable spec produces code that passes its own tests.

The best specs read like a specification an agent could execute without asking clarifying questions. If you read your spec and think "an agent would have to guess here," that's where you need more precision.

---

**Questions this guide doesn't answer:**

- How to pick a design system that supports this workflow. (Short answer: any system with documented component props will do.)
- How to convince your team to adopt this. (Short answer: pilot it on one feature. Show the defect reduction. Teams convert.)
- How to write Type Contracts if you don't know TypeScript. (Short answer: write the shapes in plain English. Dev + Claude Code will transliterate.)

Happy to extend the guide with any of these if useful.
