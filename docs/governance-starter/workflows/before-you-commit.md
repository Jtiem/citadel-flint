# Before You Commit

> Run through this checklist before every commit.
> It takes 2 minutes and prevents hours of debugging.

## Quick Check (do every time)

- [ ] **Does it run?** Start the app. Does it work without errors?
- [ ] **Do tests pass?** Run your test command. All green?
- [ ] **No secrets?** Quick scan — no API keys, passwords, or tokens in the code?
- [ ] **No debug junk?** Remove any `console.log` you added while debugging
- [ ] **No commented-out code?** Delete it. Git remembers the old version if you need it back.

## If You Changed How Something Works

- [ ] **Updated the docs?** If you changed the architecture, update `rules/HOW-ITS-BUILT.md`
- [ ] **Error messages helpful?** For any new errors — do they say what went wrong AND what to do?
- [ ] **Tests for the new stuff?** At minimum: does it work with good input? Does it not crash with bad input?

## If You're Using AI to Write Code

- [ ] **Read what it wrote.** Don't just accept AI output blindly. Read it like a code review.
- [ ] **Check for hallucinations.** AI sometimes imports packages that don't exist, calls functions with wrong arguments, or makes up API endpoints.
- [ ] **Check for hardcoded values.** AI loves to hardcode things that should be configurable (colors, URLs, sizes, strings).

## Commit Message

Write a message that answers: "If I read this in 6 months, will I understand what changed and why?"

Good: `"Fix login timeout by increasing session TTL from 15min to 1hr"`
Bad: `"fix bug"` / `"update stuff"` / `"WIP"`
