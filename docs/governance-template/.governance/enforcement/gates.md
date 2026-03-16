# Enforcement Gates

> Gates block a desired action (ship, merge, export) until conditions are met.
> They are the most impactful enforcement mechanism after architecture-level constraints.

---

## Gate 1: [Export / Ship / Deploy Gate]

**Blocks:** [What action is blocked — export, merge, deploy, publish]

**Conditions to pass:**
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] All tests pass (`npm test`)
- [ ] No critical-severity lint violations
- [ ] [Domain-specific condition — e.g., "no a11y violations", "no unresolved TODOs"]

**Bypass policy:** [Can this gate be bypassed? Under what conditions? Who approves?]

---

## Gate 2: [Merge Gate]

**Blocks:** PR merge to main/release branches

**Conditions to pass:**
- [ ] CI pipeline green
- [ ] Code review approved
- [ ] No commandment violations flagged by reviewer
- [ ] Documentation updated (Commandment 8)

**Bypass policy:** [Emergency hotfix process, if any]

---

## Gate 3: [AI Output Gate]

**Blocks:** AI-generated code from being presented to the user

**Conditions to pass:**
- [ ] In-memory type check passes
- [ ] Lint rules pass on generated output
- [ ] Output uses only operations from the versioned tool catalog

**Bypass policy:** None. AI output must always pass validation before the user sees it.

---

## Enforcement Tier Reference

| Tier | Mechanism | Impact | Maintenance |
|------|-----------|--------|-------------|
| 1 | Architecture constraints | Highest — impossible to violate | Zero |
| 2 | Hard gates (this file) | High — blocks desired action | Low |
| 3 | AI context injection | High for AI-assisted work | Medium |
| 4 | Automated linting | Medium — catches, requires action | Medium |
| 5 | Procedural workflows | Medium — depends on discipline | Low |
| 6 | Documentation only | Lowest — decays without reinforcement | Low |
