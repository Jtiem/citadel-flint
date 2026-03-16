# Workflow: Pre-Commit Audit

> Run before committing code. Verifies commandment compliance and catches issues early.

## Trigger
- Before any commit
- Before any PR creation
- When requested by the reviewer

## Steps

### 1. Commandment Scan
Read `.governance/COMMANDMENTS.md` and verify each commandment against the changed files:

- [ ] C1: All mutations persist to source of truth
- [ ] C2: No environment boundary violations
- [ ] C3: No new gate-blocking violations introduced
- [ ] C4: No specification drift without spec update
- [ ] C5: Complex operations use appropriate execution strategy
- [ ] C6: All writes are atomic
- [ ] C7: No string manipulation of structured data
- [ ] C8: Documentation reflects the change

### 2. Type Check
```bash
npx tsc --noEmit
```
Zero errors required.

### 3. Test Suite
```bash
npm test
```
All tests must pass. Note any new flaky tests.

### 4. Error Message Audit
For any new `throw` or `catch` blocks:
- Does the error message explain WHAT happened?
- Does it tell the user WHAT TO DO?
- Is any catch block swallowing errors silently?

### 5. Documentation Check
If architecture changed:
- [ ] `.governance/ARCHITECTURE.md` updated
- [ ] `.governance/HEALTH-PULSE.md` updated
- [ ] Relevant agent prompts updated

## Output
Report with:
- Commandment status (all clear / violations found)
- Type check result
- Test result
- Issues found (with file paths and recommended fixes)
