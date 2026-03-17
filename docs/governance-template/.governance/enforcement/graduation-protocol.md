# Rule Graduation Protocol

> Every rule starts somewhere. The best rules graduate from documentation to architecture.
> This protocol defines how rules move up the enforcement tiers.

---

## The Enforcement Ladder

```
Tier 6: Documentation only     → "We agreed not to do X"
Tier 5: Procedural workflow     → "The audit script checks for X"
Tier 4: Automated linting       → "The linter warns about X"
Tier 3: AI context injection    → "AI agents are told not to do X"
Tier 2: Hard gate               → "You can't ship if X is present"
Tier 1: Architecture constraint → "It's structurally impossible to do X"
```

---

## Graduation Process

### Step 1: Identify the Rule
A bug, violation, or risk is discovered. Document it as a candidate commandment.

**Template:**
```
Rule: [Binary statement — e.g., "All color values must reference a design token"]
Triggered by: [What incident revealed this need]
Current enforcement: [None / Documentation / Linting / Gate]
Target enforcement: [Linting / Gate / Architecture]
```

### Step 2: Impact Assessment
- How many existing files violate this rule?
- What's the cost of retroactive compliance?
- Does this rule conflict with any existing commandment?

### Step 3: Select Enforcement Mechanism
Choose the highest-impact tier that's practical:

| If the rule is about... | Use... |
|---|---|
| What code CAN'T structurally do | Tier 1: Architecture constraint |
| What blocks shipping | Tier 2: Hard gate |
| What AI agents must check | Tier 3: AI context injection |
| What's automatically detectable | Tier 4: Automated linting |
| What's procedurally checkable | Tier 5: Workflow |
| What's aspirational for now | Tier 6: Documentation (with a graduation date) |

### Step 4: Implement
- Write the gate logic, lint rule, or architecture constraint
- Add test coverage for the enforcement mechanism itself
- Update the relevant agent prompts

### Step 5: Update Governance Docs
- Add or bump the commandment in `COMMANDMENTS.md`
- Update `HEALTH-PULSE.md` with the new enforcement
- Update all agent `.md` files that reference commandments

---

## Graduation Debt

Rules stuck at Tier 6 (documentation only) for more than 2 sprints should either:
1. Graduate to a higher tier, or
2. Be acknowledged as aspirational and tracked in `HEALTH-PULSE.md` under Governance Debt

Track this in the health pulse:
```
| Rule "No hardcoded colors" | Tier 6 since v1.2 | Needs linter rule | Medium priority |
```
