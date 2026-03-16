# My Project Rules

> These are the non-negotiable rules for this project.
> If any rule is broken, the code isn't ready to ship. Period.
>
> HOW TO USE THIS:
> - Read each rule below
> - Keep the ones that apply, delete the ones that don't
> - Add your own at the bottom
> - Each rule must be a YES/NO question (not "try to" or "should")

---

## Rule 1: Save it or it doesn't exist

Every change must be saved to a real file. No "it works in memory" or "just refresh the page." If the app crashes, would your change survive? If not, it's not done.

**Why this matters:** You'd be surprised how often code "works" only because of temporary state. When AI writes code, it sometimes creates things that look right but aren't actually persisted anywhere.

**How to check:** After making a change, restart the app. Is the change still there?

---

## Rule 2: If it breaks, tell the user what to do

Every error message must answer two questions:
1. What went wrong?
2. What should I do about it?

"Error: ENOENT" is bad.
"File not found: config.json. Run 'npm run setup' to create it." is good.

**Why this matters:** Unhelpful errors waste hours. If you write a good error message once, it saves time forever — for you, your users, and AI agents that hit the same error.

**How to check:** Search your code for `throw new Error` and `catch`. Does every error message tell the user what to DO?

---

## Rule 3: Tests must pass before shipping

The test suite must pass with zero failures before any code is merged or deployed. No "oh that test has been failing for weeks, just ignore it."

**Why this matters:** A failing test that everyone ignores is worse than no test at all — it teaches the team that test failures are acceptable.

**How to check:** Run `npm test` (or your test command). Is it all green?

---

## Rule 4: Don't commit secrets

No API keys, passwords, tokens, or credentials in the codebase. Ever. Use environment variables or a secrets manager.

**Why this matters:** Once a secret is in git history, it's there forever (even if you delete the file). Bots scrape GitHub for exposed keys within minutes.

**How to check:** Search for patterns like `sk-`, `AKIA`, `password =`, `token =` in your code. Add a `.gitignore` for `.env` files.

---

## Rule 5: Document what you changed

If you change how something works, update the notes. Don't leave your future self (or your teammate, or your AI assistant) guessing what happened.

**Why this matters:** Code without context is a puzzle. Three months from now, you won't remember why you made that change. Write it down now while it's fresh.

**How to check:** Did you update `HOW-ITS-BUILT.md` if you changed the architecture? Did you update the relevant agent file if you changed a module's responsibility?

---

## My Custom Rules

> Add rules specific to your project below. Remember: each must be YES/NO testable.

### Rule 6: [Your rule here]

[Why it matters]

[How to check]

---

### Rule 7: [Your rule here]

[Why it matters]

[How to check]

---

## Examples of Good Custom Rules

Need inspiration? Here are rules that have worked well on real projects:

- **"Every component must be accessible"** — Can a screen reader user navigate it? (Run an accessibility checker to verify.)
- **"No direct database calls from the frontend"** — All data flows through an API layer.
- **"Every new feature needs at least one test"** — Not 100% coverage, just prove it works.
- **"Colors must come from the design system"** — No hardcoded hex values like `#1a2b3c`.
- **"All user-facing text must be translatable"** — No hardcoded English strings in components.
- **"API responses must follow the standard format"** — Every endpoint returns `{ data, error, meta }`.
