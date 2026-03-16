# Health Pulse — [Date]

> Living health report. Update at session end via the `session-end` workflow.
> Tracks module health, test status, active work, and known risks.

---

## Module Health

| Module | Status | Tests | Notes |
|--------|--------|-------|-------|
| [Module A] | GREEN | 42/42 | Stable |
| [Module B] | YELLOW | 18/20 | 2 flaky tests — tracking in #123 |
| [Module C] | RED | 0/0 | No test coverage yet |

**Status key:** GREEN (stable, tested), YELLOW (functional, known issues), RED (broken or untested)

---

## Test Suite

- **Total:** X/Y passing
- **Coverage:** Z%
- **Flaky tests:** [List or "None"]
- **Last full run:** [Date/time]

---

## Active Work

| Branch | Phase | Owner | Status |
|--------|-------|-------|--------|
| `feature/x` | Phase N | [agent/person] | In progress |
| `fix/y` | Hotfix | [agent/person] | Ready for review |

---

## Known Risks

1. [Risk 1 — what could break, what's the mitigation]
2. [Risk 2]

---

## Governance Debt

| Item | Type | Impact |
|------|------|--------|
| [Commandment X has no tooling enforcement] | Rule without gate | Medium |
| [Agent Y references outdated commandment count] | Stale prompt | Low |
| [No tests for module Z] | Coverage gap | High |

---

## Recent Changes

- [Date]: [What changed and why]
- [Date]: [What changed and why]
