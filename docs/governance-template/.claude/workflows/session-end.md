# Workflow: Session End

> Run at the end of every development session to maintain the living health report.

## Trigger
- End of every coding session
- After completing a significant feature or phase

## Steps

### 1. Update Health Pulse
Open `.governance/HEALTH-PULSE.md` and update:

- **Module Health:** Change status of any modules affected during this session
- **Test Suite:** Update pass/fail count and coverage
- **Active Work:** Update branch status and ownership
- **Known Risks:** Add any new risks discovered
- **Recent Changes:** Add a line for today's work

### 2. Check Governance Debt
Scan for:
- Commandments with no tooling enforcement (still at Tier 6)
- Agent prompts that reference outdated commandment counts
- Modules with no test coverage (RED status)
- Documentation that contradicts the current architecture

Add any findings to the Governance Debt section.

### 3. Verify Documentation Autopilot (Commandment 8)
If any code was changed this session:
- [ ] Architecture spec reflects the change (if architectural)
- [ ] Health pulse reflects the change
- [ ] Agent prompts are current

### 4. Clean Up
- [ ] No uncommitted changes that should be committed
- [ ] No TODO comments without tracking issues
- [ ] No temporary debug logging left in code

## Output
Updated `HEALTH-PULSE.md` with current date and session summary.
