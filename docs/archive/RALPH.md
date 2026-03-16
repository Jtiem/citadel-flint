# Bridge IDE — Ralph Task

## Goal
Run `npm test`. If any tests fail, read the error output, locate the
failing code, fix it, and run `npm test` again.

## Completion Promise
Output exactly: RALPH_DONE

## Rules
- Never delete tests. Fix the implementation, not the tests.
- All fixes must pass `npx tsc --noEmit` (0 errors).
- Commit each working fix with a meaningful message.
