# Flint Enterprise Governance Demo
## Unified Config + Enterprise Rule Management

**Audience:** Design system leads, CTOs, CISOs, enterprise buyers
**Duration:** 7 minutes
**Format:** Live terminal + Flint Glass side by side

---

## The Setup

You are a design system lead at a healthcare company called MedChart. Your team just adopted AI-assisted UI development — Claude Code generating components, Cursor agents refactoring layouts. Speed is up. So is anxiety: how do you know every generated component meets your clinical color standards, WCAG requirements, and the audit retention rules your legal team cares about?

Right now, your answer is code review. Manual. Slow. Incomplete.

Flint's answer is a single YAML file.

---

## Act 1: Zero to Governed in 3 Lines

**Duration: 2 minutes**

### The Story

The project has no governance config. Show what that means, then fix it in under a minute.

### Commands

**Step 1 — Start with nothing.**

In Claude Code (or any terminal with MCP connected), ask Flint for the current project status:

```
flint_status
```

Expected output:

```json
{
  "status": "online",
  "config": "defaults",
  "activePresets": [],
  "delta_e": 2.0,
  "trust.default_tier": "senior",
  "audit.retention": "30d"
}
```

The project is running on defaults. Liberal thresholds. Short retention. Any agent at senior trust out of the box.

**Step 2 — Create the config.**

Open a new file: `flint.config.yaml` at the project root.

Type exactly this:

```yaml
project: MedChart Pro
extends:
  - "@flint/healthcare"
```

Save it.

**Step 3 — Verify what activated.**

```
flint_list_rule_packs
```

Expected output (summarized):

```
ACTIVE   wcag-2.1-aa          50 rules   EU/EAA  US/ADA  Section 508
ACTIVE   mithril-design-system 14 rules   brand
ACTIVE   hipaa-ui              8 rules    US/HIPAA

Config source: @flint/healthcare
delta_e: 1.5  (was 2.0)
trust.default_tier: junior  (was senior)
audit.retention: 2190d  (was 30d)
```

### Key Moment

"Three lines. Fifty accessibility rules now block export on violation. Color drift detection tightened from delta-E 2.0 to 1.5 — that's the perceptual difference between two blues that looks fine on a monitor but reads as inconsistent on a clinical display. Six years of audit retention. Default agent trust dropped from senior to junior — no AI agent can make structural changes without approval.

Three lines. Done."

### Talking Points

- The `@flint/healthcare` preset was designed for clinical UI environments where color fidelity, accessibility, and audit trails are operational requirements, not afterthoughts.
- WCAG 2.1 AA enforcement runs at the AST level — it catches violations before a human reviews a single line of code.
- Nothing in the preset constitutes regulatory certification. It aligns your governance posture with the technical requirements that sit alongside your compliance program.

---

## Act 2: The Enterprise Stack

**Duration: 3 minutes**

### The Story

The preset is a starting point. Show what a real enterprise config looks like — and then demonstrate what happens when an AI agent tries to make a high-risk structural change.

### Commands

**Step 1 — Expand the config.**

Update `flint.config.yaml`:

```yaml
project: MedChart Pro
domain: healthcare
classification: restricted

extends:
  - "@flint/healthcare"
  - "acme-corp/medchart-standards"

tighten_only: true

rules:
  mithril:
    mode: coercive
    delta_e: 1.5
  accessibility:
    level: AA
    mode: coercive

trust:
  default_tier: junior
  profiles:
    - id: claude-code
      tier: senior
  approval:
    - condition: { risk_score: { gt: 60 } }
      action: require_approval
    - condition: { risk_score: { lt: 25 } }
      action: auto_approve

audit:
  retention: 2190d
  export: [json, sarif]
```

**Step 2 — Watch an approval gate fire.**

Ask an agent to make a structural change — something that scores above 60 on the mutation risk scale. For example, ask Claude Code:

```
Refactor the PatientCard component to extract the vitals display into a new VitalsPanel component.
```

Flint intercepts the mutation before it executes. In the Glass Activity Feed, you will see:

```
[APPROVAL REQUIRED]
Tool: flint_ast_mutate
Risk score: 74  (threshold: 60)
Agent: claude-code (senior)
Mutations: 3 structural, 2 import

Approve / Reject
```

The agent is paused. The mutation has not touched the file system. Click "Approve" to proceed or "Reject" to discard.

**Step 3 — Open Flint Glass. GovernancePanel. Rule Packs tab.**

In the Glass right sidebar, switch to the "Governance" panel and select the "Rule Packs" tab.

What you see:
- An accordion organized by domain: Accessibility, Brand, Privacy, Security, Cognitive
- Each pack shows its name, rule count, jurisdiction tags, and an Active/Available/Coming Soon badge
- The Accessibility domain shows "wcag-2.1-aa" and "hipaa-ui" both marked Active with emerald badges
- A search bar and domain filter at the top let you narrow the list instantly

Enable a pack by clicking the "Enable" button next to any Available pack. The change is written atomically to `flint.config.yaml` and takes effect immediately — no restart required.

**Step 4 — Switch to the "Profiles" tab.**

The Compliance Profile Selector shows a jurisdiction checklist:

```
[x] EU — European Accessibility Act      EU
[x] US — ADA Title II                    US
[ ] GDPR Consent Patterns               EU   (soon)
[ ] CCPA/CPRA Privacy                   US   (soon)
[ ] PCI-DSS (fintech)                   US   (soon)
[x] HIPAA (healthcare)                  US
[x] Section 508 (US federal)            US
```

Check "EU — European Accessibility Act." The `@flint/wcag-aa` preset is written to `extends`. The Coverage Dashboard updates immediately.

**Step 5 — Switch to the "Health" tab. Show the CoverageBar.**

The Coverage Dashboard shows per-jurisdiction progress bars:

```
Compliance Coverage                    87% overall

EU/EAA      46/50   ████████████████░░░░   92%
US/ADA      46/50   ████████████████░░░░   92%
Section 508 46/50   ████████████████░░░░   92%
US/HIPAA     6/8    █████████████░░░░░░░   75%
```

Green bars (above 80%) for the active accessibility profiles. The HIPAA bar is amber — 6 of 8 rules active, 2 gaps remaining in the coming-soon packs.

### Key Moment

"Your CISO can see exactly what's covered and what isn't. The coverage bar is sourced from the live rule engine — not a marketing checklist. When a new HIPAA pack ships, that bar updates automatically. And the export gate is live: anything below the threshold blocks shipping."

### Talking Points

- The approval gate is not advisory. The mutation is paused in memory. Nothing wrote to disk until you approved it.
- `classification: restricted` halved the color drift threshold and set approval required above risk score 30 automatically. The line in the config is the audit trail.
- The Rule Catalog is browsable and searchable. You can filter by jurisdiction — type "GDPR" and see exactly which rules address it, what their current mode is, and whether they have auto-fix implementations.

---

## Act 3: The Inheritance Story

**Duration: 2 minutes**

### The Story

Large organizations need org-wide mandates that individual teams cannot override. Show that the config system enforces this structurally — it is not a social contract.

### Commands

**Step 1 — Show the InheritanceChain in Glass.**

In the Health tab of the Governance Dashboard, the Config Inheritance section shows a horizontal chain:

```
[healthcare]  >  [medchart-standards]  >  (project)
   preset           local                  project
```

- Indigo node: official `@flint/healthcare` preset (the org baseline)
- Zinc node: `acme-corp/medchart-standards` local config (the org override layer)
- Emerald node: the project's own `flint.config.yaml` (the terminal, most-derived config)

Below the chain: "Inherited presets use tighten-only mode — project config can only tighten, not relax."

**Step 2 — Try to relax a parent rule.**

Attempt to weaken the accessibility enforcement in `flint.config.yaml`:

```yaml
rules:
  accessibility:
    level: A        # downgrading from AA
    mode: advisory  # downgrading from coercive
```

Save the file. Immediately in Glass, the Governance Dashboard shows a validation error:

```
Config validation error:
  rules.accessibility.level: cannot relax from parent value "AA" to "A"
  rules.accessibility.mode: cannot relax from parent value "coercive" to "advisory"
  tighten_only is active — child configs may only tighten inherited values.
```

The project loads with defaults for the invalid fields. The parent rule stands.

**Step 3 — Show what teams CAN do.**

A team config can legitimately tighten further. Add to `flint.config.yaml`:

```yaml
rules:
  mithril:
    delta_e: 1.0   # tighter than the parent's 1.5 — valid
```

No error. The team made their project stricter than the org baseline. That is always allowed.

### Key Moment

"Teams can customize. They can tighten rules to match their component domain. What they cannot do is weaken what the organization mandated. The tighten-only invariant is structural — it is enforced at config parse time, not by trust or convention."

### Talking Points

- The inheritance chain is visible to every developer on the team in Glass. There is no mystery about where a rule came from or why it is there.
- Rolling back a team override is one line: remove it from `extends`. The org baseline is untouched.
- This is how you delegate governance without losing control. The org sets the floor. Teams own the ceiling.

---

## Demo Commands Reference

### Terminal (MCP tools via Claude Code)

| Command | When to run |
|---------|-------------|
| `flint_status` | Act 1 — show the pre-config defaults |
| `flint_list_rule_packs` | Act 1 — show what the healthcare preset activated |
| `flint_compliance_coverage` | Act 2 — show per-jurisdiction coverage percentages |
| `flint_audit` | Any time — show the current violation state |
| `flint_risk_score` | Act 2 — score a specific mutation before running it |

### In Flint Glass

| Action | Location |
|--------|----------|
| Open Rule Catalog | Right sidebar > Governance tab > Rule Packs sub-tab |
| Open Compliance Profiles | Right sidebar > Governance tab > Profiles sub-tab |
| View Coverage Dashboard | Right sidebar > Governance tab > Health sub-tab |
| View Inheritance Chain | Right sidebar > Governance tab > Health sub-tab (below coverage bars) |
| Watch approval gate fire | Activity Feed (auto-surfaces when a mutation is intercepted) |

---

## FAQ / Objection Handling

**"Does this actually enforce HIPAA?"**

No, and we do not claim that it does. HIPAA compliance is a legal and organizational program. Flint enforces the UI governance layer that sits alongside that program: it ensures that PHI display patterns, session timeout indicators, secure form markers, and accessibility requirements are present and correct at the code level. Your compliance team owns the program. Flint makes the UI part of it auditable and automated.

**"What if my team uses Vue or Svelte, not React?"**

Flint's governance engine operates on a Universal AST abstraction that is framework-agnostic. The `flint.config.yaml` format, the rule packs, the MCP tools, and the approval gate are all independent of framework. Preview rendering in Flint Glass is currently React-first, but the governance pipeline that enforces rules and blocks exports handles multiple target frameworks.

**"Can we bring our own rules?"**

Yes, two ways. First: write a local YAML config file and reference it in `extends`. Second: use the Governance Pack Exchange to import a published pack from a registry — your organization can publish internal packs and install them with one `extends` entry. Rollback is removing that line.

**"What about CI/CD?"**

`flint-ci` runs the same governance engine headlessly. Same `flint.config.yaml`, same rules, same approval logic — but in a pipeline context where violations produce exit code 1 and SARIF output for your security dashboard. There is no separate CI config to maintain. The same file governs local development and the deployment gate.

**"How do we know the AI agent actually stopped?"**

The approval gate intercepts at the IPC layer before any file write occurs. The mutation exists only in memory. Flint Glass shows the pending mutation — the diff, the risk score, the agent identity — and waits for an explicit human decision. The file system is not touched until approval is granted. You can verify this by watching the file's modification timestamp in your IDE while the approval prompt is open.

**"Can agents be trusted more selectively?"**

Yes. The trust tier system lets you grant specific agents higher autonomy by agent ID. In the config above, `claude-code` is at `senior` while all other agents default to `junior`. Promotion and demotion happen automatically based on session behavior — an agent that repeatedly triggers coercive violations is automatically downgraded.

---

## Visual Aids to Capture

These are the recordings and screenshots Justin should prepare before a live demo:

1. **Rule Catalog panel** — Flint Glass, Governance panel, Rule Packs tab open. Scroll through the accordion to show Accessibility domain expanded with wcag-2.1-aa at 50 rules, Active badge in emerald. Then type "hipaa" in the search bar to filter. Capture as a screen recording (30 seconds).

2. **Coverage Dashboard with healthcare presets active** — Health tab showing the CoverageBar with EU/EAA at 92%, US/HIPAA at 75% in amber. The "87% overall" figure in the top right. Static screenshot is sufficient.

3. **Inheritance Chain — three-node chain** — `healthcare` preset node (indigo) > `medchart-standards` local node (zinc) > `(project)` terminal node (emerald). Static screenshot. Capture before the tighten-only violation demo so the chain is clean.

4. **Tighten-only validation error** — The config validation error displayed in Glass after attempting to downgrade accessibility level. Static screenshot of the error callout in the Governance Dashboard.

5. **Terminal: `flint_list_rule_packs` output** — Show the before state (empty `activePresets`, defaults) and the after state (three packs active, tightened delta_e, 2190d retention). Side-by-side or sequential screenshots.

6. **Terminal: `flint_compliance_coverage` output** — The per-jurisdiction coverage object showing covered/total numbers and percentage for each active jurisdiction. Static screenshot.

7. **Approval gate intercept** — Activity Feed showing the `[APPROVAL REQUIRED]` card with risk score 74, agent identity, mutation count, and the Approve/Reject buttons. Capture before clicking either. Screen recording if possible (10 seconds showing the card appear after the agent call).

---

## What This Is Not

Flint does not replace a legal compliance program, a security audit, or a penetration test. It enforces the UI governance layer: design system fidelity, accessibility at the AST level, and AI agent behavior. These are necessary conditions for compliant software. They are not sufficient on their own.

The presets encode governance posture appropriate for each industry. They do not constitute certification under any regulatory framework.
