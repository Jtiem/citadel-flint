# Governance Education System — Flint Glass

**Date:** 2026-03-27
**Author:** Flint Product Planner
**Depends on:** GOVERNANCE-UX-REVIEW.md, UX-OPPORTUNITIES.md
**Status:** APPROVED FOR PLANNING

---

## Executive Summary

Flint Glass is fluent in its own language. Designers are not. Every governance surface — badges, chips, colors, scores, rule IDs, metric labels — is rendered correctly but explained nowhere. A designer who sees "Amber," "ΔE 4.2," "MITHRIL-COL-001," or a health score of "B" has no way to understand what any of them mean without asking someone who already knows Flint. This document designs the system that teaches governance concepts in context, without tutorials, docs, or onboarding flows.

The strategy has three levels:
- **Level 1 — Inline:** Every element is self-explanatory or has a plain-language tooltip.
- **Level 2 — Contextual:** Click or expand to see why the rule exists, what it catches, how to fix it.
- **Level 3 — Reference:** One place in the product where all governance concepts are explained.

The error taxonomy at `flint-mcp/src/core/errorTaxonomy.ts` already has 50 plain-language explanations — `title`, `explanation`, and `recovery` fields — that power Level 2. The system does not need to invent new content. It needs to surface what already exists to the right place at the right moment.

---

## Part 1: Complete Inventory of Governance UI Elements

### 1.1 ShieldOverlay (canvas badges)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Amber badge on node | Color-coded pill, top-left of node bounding box | Triangle icon, optional count number | This node has a design system problem that doesn't block export yet | `aria-label` says "N governance violations on nodeId" | No plain-language explanation of what "governance violation" or "amber" means. The aria-label is for screen readers, not visible UI. |
| Red badge on node | Color-coded pill, top-left of node bounding box | Triangle icon, optional count number | This node has a problem that WILL block export | Same as above | No explanation of why red is worse than amber or what specifically triggers the escalation. |
| Amber heat tint | Semi-transparent fill on node bounds | `bg-amber-500/10` overlay | Same node has a warning-level drift issue | None | No visible label. A user who doesn't know the color convention learns nothing. |
| Red heat tint | Semi-transparent fill on node bounds | `bg-red-500/10` overlay | Node has a critical violation | None | Same problem. Color with no label. |
| Amber/red border outline | Rounded border on node bounds | Colored border stroke | Node boundary indicator for violations | None | Purely visual, never labeled. |
| Lock icon (top-right of node) | Small pill with lock icon | Lock icon in red circle | Another user is editing this node — you can't edit it | `title="Locked by another user"` on the div | Reasonable. Could add "who" locked it. |

### 1.2 ViolationTooltip (canvas hover popover)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Tooltip header count | "N Violations" | "2 Violations" | Total count of problems on this node | Count is shown | No breakdown of why that number matters |
| "Design Drift" section header | Uppercase label | "DESIGN DRIFT" | These are design system mismatches (colors, spacing, type) | Already uses "Design Drift" language — good | No definition of what drift means in practical terms |
| Rule ID chip | Monospace code | "MITHRIL-COL-001" | The specific rule that fired | Rule ID shown in mono | The ID means nothing to a designer. No mapping to plain language. |
| Severity label | Small badge | "amber" or "critical" | How serious this violation is | Label shown | No explanation of what amber vs. critical means for export or workflow |
| ΔE value + natural language | Text line | "ΔE 8.4 — very different from token" | How far off-spec the color is | Partial — "very different from token" is good. "slightly off" and "noticeably different" thresholds exist. | The ΔE number itself is still prominent and unexplained. A designer shouldn't need to know what 4.5 vs. 8.4 means in absolute terms. |
| Suggested fix arrow | Green arrow + token name | "Suggested fix: text-brand-500 (#4f46e5)" | The replacement that would fix this | Present and reasonably clear | Good, but no explanation of what "applying" this fix means to the code |
| "Accessibility" section header | Uppercase label | "ACCESSIBILITY" | These are WCAG problems that must be fixed before export | Present | No statement that these are different from drift violations in severity or consequence |
| A11y rule ID | Monospace code | "A11Y-001" | Specific accessibility rule | Shown | Means nothing without a lookup |
| A11y message body | Text | "Missing alt text on image" | Plain-language description of the a11y violation | Present — this is already good for most a11y rules | Variable quality: some messages are clear, others are technical |

### 1.3 GovernanceOverlay (violation list in right sidebar)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Section header | Label + count chip | "GOVERNANCE" + count badge | How many violations exist in the active file | Count shown | "Governance" is jargon. No definition. |
| Violation type label | Text | "Color Drift", "Accessibility", "Spacing Drift" | Category of the problem | Present — these are already plain English | Reasonable. Could add a one-line definition on hover. |
| Severity badge | Chip | "amber" or "critical" | Severity of this specific violation | Badge shown | No explanation of what amber vs. critical means for workflow or export. |
| Node ID | Monospace text | "#flint-node-abc123" | Which element on screen has this problem | Node ID | Unintelligible to a designer. Should show component name or element type if available. |
| Violation message | Text, clamp-2 | "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set" | What went wrong and what the value is | Rule ID + description | Rule ID prefix is still jargon. Message is often clipped at 2 lines before the most useful part (the ΔE value). |
| Arrow + token suggestion | Green line | "Use text-brand-500 (#4f46e5) instead" | The correct replacement | Present | Good. But no explanation of what "instead" means for the code. |
| Hardcoded class → token swap preview | Before/after strip | "bg-[#3b82f6] → text-brand-500" | What the code will look like after fix | Present in hover diff | Only visible on hover. Touch and keyboard users miss it. |
| Auto-Fix button | Button with wrench icon | "Auto-Fix" | This will apply the replacement automatically | Button label | No explanation of what "automatically" means — will it break anything? Is it reversible? |
| Configure rule gear icon | 10px icon button | Settings icon | Opens GovernancePanel to this rule | `title="Configure rule MITHRIL-COL"` | 10px. Nearly invisible. Title uses jargon. Behavior ("configure") is vague. |

### 1.4 GhostOverlay (hardcoded values floating card)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Card header | Label | "HARDCODED VALUES" | This element uses values outside your design system | Present | "Hardcoded values" is a developer term. A designer's mental model is "these colors/spacings aren't from my design system." |
| Node ID badge | Monospace text | "Node: flint-node-abc123" | Which element is selected | Present | Same problem as GovernanceOverlay — node ID is opaque. |
| Hardcoded class chip | Amber chip | "bg-[#3b82f6]" | The specific class that's wrong | Present | The class syntax (`bg-[#3b82f6]`) is a Tailwind implementation detail. A designer understands "background color" better than class names. |
| Arrow | Symbol | "→" | This is what to use instead | Has `aria-label="replace with"` | Good for a11y. Visually context is clear. |
| Suggestion chip | Indigo chip | "bg-brand-500" | The token-backed replacement | Present | No explanation of what this value maps to visually (no swatch). |
| "No matching token" message | Italic text | "no matching token — add this value to your design tokens" | The fix requires adding to the design system | Present | Good instruction but no path to do it — no link to the Tokens tab or Figma sync. |
| Footer hint | Small text | "Replace with the nearest token class to pass the Mithril gate." | Context for why this matters | Present | "Mithril gate" is jargon. "Mithril" appears three times in this card with no definition. |

### 1.5 GovernanceDashboard (Health tab in right sidebar)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Score ring | SVG progress circle | A number 0–100 inside a colored arc | Overall governance health of the active file | `aria-label="Health score N out of 100"` | No explanation of what the score measures or what changes it. A score of 72 means nothing without context. |
| Grade letter | Large letter | "A" through "F" | Grade tier corresponding to the score | `aria-label="Grade N"` | No rubric for what grade means. No statement of "you need A to export" (which isn't even true). |
| Score subtitle | Small text | "Governance Health" or "Delta Score (new issues only)" | Which mode the score is in | Present | "Governance Health" is vague. "Delta Score" is unexplained. |
| Penalty breakdown | Three rows | "Mithril violations × 5 pts" / "Accessibility violations × 10 pts" / "Active overrides × 3 pts" | How the score is calculated | Labels shown | Exposes algorithm internals, not user insight. A designer wants "fixing these 2 accessibility issues would raise your score to A." |
| "Top Violated Rules" section | Rule rows with dots | Type label + severity badge + count | Which rules are firing most often | Labels present | Rows are not clickable and don't lead to any action. Data without next step. |
| Severity dot on rule row | Colored dot | Red or amber circle | Severity of that rule category | Color-only signal | No label. Color convention only. |
| "A11y" abbreviation in type label | Text | "A11y" | Accessibility | Present | "A11y" is a technical abbreviation. "Accessibility" is the plain-English word used elsewhere. Inconsistent. |
| "Delta Mode" badge | Indigo pill | "Delta Mode" | Only new violations are being counted | `title="Delta Mode — only new violations since the baseline are counted..."` | The title tooltip is good but visible only on hover. The badge label itself is opaque. |
| "Set Baseline" button | Button | "Set Baseline (N)" | Take a snapshot of current violations so only new ones count going forward | Button label is partially descriptive | No explanation of WHY you would do this or what it changes. |
| "Active Overrides" section | Warning banner | "Property overrides are active — export is blocked." | Manually changed style values are preventing export | Present — this is actually clear | Good. Only issue is "overrides" confusion with rule overrides. |
| Compliance Coverage bar | Jurisdiction coverage | Progress bars per jurisdiction label | What percentage of rules for each compliance framework are passing | Labels present | "Compliance Coverage" and jurisdiction names (WCAG, GDPR, etc.) require knowledge of what these frameworks are and why they matter. |
| Inheritance Chain | Config inheritance display | Chain of config file names | Which config files are contributing to the rule set | Labels present | Very technical. The relationship between parent/child configs is not explained. |

### 1.6 GovernancePanel (rules configuration modal)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Panel header | Title | "Governance Rules" | The full list of rules Flint enforces | Panel title | No explanation of what "governance rules" are or what the purpose of this panel is. |
| Category sidebar | Left nav buttons | "Color", "Typography", "Spacing", "Accessibility", etc. | Groups of related rules | Category names are clear | No description of what each category covers. |
| Rule ID | Monospace text | "MITHRIL-COL-001" | Stable internal identifier | Present | Meaningless to designers. |
| Rule name | Body text | "Color Drift" | What the rule checks | Present | One sentence — no description of what triggers it or what fixing it means. |
| Severity badge | Chip | "Critical" / "Warning" / "Info" | How the rule responds when it fires | Present | No explanation of consequences: does Critical block export? Does Warning? |
| "In development" badge | Dim chip | "In development" | This rule is not yet active | Present — has `title` attribute explaining it | The title explanation is good. Badge styling dims the entire row, which is correct behavior. |
| Toggle | Switch | On/Off | Whether the rule is enforced | Present | No warning about consequences of disabling. "If I turn this off, what am I allowing?" is unanswered. |
| "modified" badge | Indigo chip | "modified" | This rule has been changed from its default | Present — clickable to reset | "Modified" is clear but doesn't say what it was changed from or to. |
| Rules / Rule Packs / Profiles tabs | Tab bar | Tab labels | Three levels of rule configuration | Labels only | The relationship between tabs is not explained. Enabling a Profile activates a Pack which activates Rules — none of this is stated. |
| Save button (Rules tab only) | Button | "Save" | Changes are applied to the project config | Present | No explanation of why Pack and Profile changes don't need a Save but Rules do. The inconsistent commit model is unexplained. |

### 1.7 ExportModal (export gate)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Modal header (blocked) | Title with amber/red background | "Export Gate — Blocked" or "Export Gate — Critical Violations" | Export cannot proceed and why | Present | "Export Gate" is jargon. "Blocked" is clear but "Critical Violations" requires knowing what critical means. |
| Modal header (clear) | Title with green background | "Export Gate — All Clear" | Everything is fine, export is ready | Present | Good. "All Clear" is universal language. |
| Loading state | Progress bar + text | "Auditing 1 of 2 audit steps…" | Flint is checking things before showing results | Present | "Audit steps" is mildly technical but acceptable for this context. |
| "Property Overrides" section | Section with items | "Property Overrides (N)" | Manually changed values that haven't been applied to the design system | Has a description: "Values you manually changed that differ from the design system. Reset them in the Properties panel or apply the design token to clear." | Good. This is one of the clearest explanations in the product. |
| "Accessibility Violations" section | Red section header | "Accessibility Violations (N)" | A11y problems that must be fixed | Header label only | No explanation of WCAG requirement or why these specifically block export. |
| "Mithril Violations" section | Amber/red section header | "Mithril Violations (N)" | Design drift that must be fixed | Header label only | "Mithril" is undefined jargon in this context. |
| "Critical" badge on violation item | Red chip | "Critical" | This specific violation is more severe | Badge only | No explanation of severity consequences in this context. |
| "Auto-fixable (N)" group label | Indigo text | "Auto-fixable (N)" | These violations can be fixed automatically | Label present | Clear. |
| "Manual fix required (N)" group label | Dim text | "Manual fix required (N)" | These need human attention | Label present | Clear. |
| "Fix" button on violation row | Button with wrench | "Fix" | Should fix the violation but actually navigates to the node | Button label | BUG: says "Fix" but doesn't fix. Navigation is the actual behavior. See GOVERNANCE-UX-REVIEW.md OPP-GOV-03. |
| Compliance Summary section | Rule provenance rows | Rule ID + regulatory reference | Which standards require fixing these rules | Section header present | Regulatory citations ("WCAG 2.1 SC 1.1.1") are compliance-engineer language, not designer language. |
| "Download DBOM" button | Button | "Download DBOM" | Download a Design Bill of Materials artifact | Button label + `title` | "DBOM" is unexplained. Even the title only says "Design Bill of Materials (DBOM) as JSON" with no explanation of what that is or why you'd want it. |

### 1.8 StatusBar (footer strip)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| MCP dot + label | Color dot + text | "MCP" with emerald/red dot | Connection status to the governance engine | Dot color only — no label explaining connected vs. not | No explanation of what MCP is or what the connection enables. To a designer: "is my governance engine running?" |
| "Export Ready" chip | Green text + shield icon | "Export Ready" | File passes all checks and can be exported | Label present | Good. Universal language. |
| "N Mithril Violation(s)" chip | Amber text + alert icon | "2 Mithril Violations" | Design drift is blocking export | Label present | "Mithril" is undefined. Should be "2 Design Drift Issues" |
| "Overrides Active" chip | Amber text | "Overrides Active" | Manually changed style values are blocking export | Label present | "Overrides" is ambiguous — same word used for rule overrides which DON'T block export. |
| "Overrides (N)" count | Amber text | "Overrides (3)" | A count of governance rule customizations made this session | `title` attribute present | The `title` is good but the label "Overrides" collides with "Overrides Active" above — different meanings, same word. |
| Autopilot button | Text button | "Autopilot" | Auto-applies governance fixes as violations appear | `title` with Cmd+Shift+G shortcut | "Autopilot" is a made-up Flint term. No explanation of what it does until you read the title. Hidden until first violation — good. |
| "N fixes ready" chip | Pulsing emerald dot + text | "3 fixes ready" | Autopilot has queued fixes it can apply | Text reasonably clear | `title` explains "Apply N governance fixes (Cmd+Shift+G)" — good. |
| Figma dot + label | Colored dot + text | "Figma" or "No design system" | Connection status to Figma design system | `title` attribute per state | The "No design system" state is already good (OPP-12 from UX-OPPORTUNITIES.md was implemented). |
| "Scratchpad" chip | Amber chip | "Scratchpad" | Project is not saved to a permanent location | `title` attribute explains | Good — clear and actionable. |
| Build View / Govern View indicator | Indigo text | "Build View" or "Govern View" | Which canvas mode is active | Label present | What do these modes mean? A designer opening Glass doesn't know the difference. |

### 1.9 AgentDashboard (Agents tab in right sidebar)

| Element | Type | Literal text / appearance | What users need to understand | Current explanation | Gap |
|---------|------|--------------------------|-------------------------------|---------------------|-----|
| Risk indicator dot | Colored dot | Red/amber/emerald | This agent's overall risk level | Color only | No label on the dot. Color convention only. |
| "N mutations" text | Tiny label | "12 mutations" | How many code changes this agent has made | Present | "Mutations" is developer jargon. "Code changes" is the designer-facing equivalent. |
| Risk badge | Labeled chip | "Critical", "High", "Medium", "Low" | The agent's risk tier | Badge label present | No explanation of what the thresholds are or what "high risk" means in practice. |
| Red/amber/green count chips | Count chips | "3" in red, "5" in amber, "12" in green | How many changes were red/amber/green tier | Chips present | No explanation that red = highest-risk mutations, green = safe. No label on the chips beyond color. |
| "OVR N" chip | Amber chip | "OVR 3" | This agent overrode governance rules N times | `title` attribute: "N governance override(s)" | "OVR" is an abbreviation. The title is good but only on hover. |
| "Agent Risk Dashboard" header | Section title | "Agent Risk Dashboard" | What this panel shows | Has a subtitle: "Risk scores are based on mutation patterns, override frequency, and error rates." | Good — this is one of the best plain-language descriptions in the product. |
| Consensus Gate section | Stats grid | "Evaluations", "Disagreement", "Last 24h" | Secondary agent review results | Labels present | "Consensus Gate" and "Disagreement" are technical terms. A designer wants: "A second AI reviewed these changes — here's how often it disagreed." |

---

## Part 2: Terminology Translation Table

The following table maps internal/technical terms to their user-facing replacements. These translations apply to ALL user-facing surfaces: visible labels, tooltips, notification toasts, panel headers, and button text. Internal code names remain unchanged in code identifiers, store names, IPC channels, and developer tooling.

| Internal term | User-facing replacement | Where it appears | Why |
|--------------|------------------------|-----------------|-----|
| Mithril | Design drift check | StatusBar chip, ExportModal section header, GovernanceDashboard penalty row, GhostOverlay footer | "Mithril" is a Citadel codename. "Design drift" describes what the check actually does. |
| Warden | Accessibility check | ExportModal section, ViolationTooltip header | "Warden" is a Citadel codename. "Accessibility" is the universal term. |
| ΔE / Delta-E | Color distance (numeric value can appear in parentheses) | ViolationTooltip, ExportModal violation messages | ΔE is a perceptual color science metric. "Color distance" is understandable to any designer. |
| CIEDE2000 | (hide entirely) | Nowhere in UI | Implementation detail. No designer needs to know the name of the algorithm. |
| MITHRIL-COL-001 (and all rule IDs) | Rule ID shown in collapsed/secondary position only | GovernancePanel rule rows, ViolationTooltip, violation messages | Rule IDs are stable references for power users and engineers, but should never be the primary label. Always paired with a human name. |
| amber (severity) | Warning | All severity badges | "Amber" is a traffic-light color with no universal severity meaning. "Warning" is the standard pattern used in every major design system (VS Code, GitHub, Linear, Figma). |
| critical (severity) | Blocks export | Severity badges when on a11y violations or ΔE > 10 violations | "Critical" is vague. The specific consequence — "blocks export" — is what the user needs to understand. |
| Export Gate | Export check | StatusBar, ExportModal title (secondary) | "Gate" is jargon. "Export check" or "Export readiness" is plain language. |
| Governance | (keep for panel/dashboard titles, replace in violation surfaces) | See below | "Governance" is appropriate for the configuration panel and health dashboard where the concept has been established. In violation tooltips and inline surfaces, prefer "design system check" or "design check." |
| Delta Mode | New issues only | GovernanceDashboard badge | "Delta Mode" sounds technical. "New issues only" states the behavior directly. |
| Overrides Active (StatusBar) | Unapplied style changes | StatusBar export chip | Distinguishes property overrides (blocking) from rule overrides (non-blocking). |
| Overrides (N) (GOV.2 count) | Rule customizations (N) | StatusBar governance override count | Distinguishes rule overrides from property overrides. |
| Mutation | Code change | AgentDashboard, ActivityFeed | "Mutation" is an AST/compiler term. "Code change" is universal. |
| Auto-Fix | Apply fix | GovernanceOverlay button, ExportModal | "Auto-Fix" is engineering language. "Apply fix" is what the user understands. |
| DBOM | Design Bill of Materials | ExportModal download button | The full term should be spelled out on first use, with the abbreviation in parentheses for power users. |
| "In development" (GovernancePanel) | Coming soon | GovernancePanel rule rows | "In development" implies something actively building. "Coming soon" is friendlier and sets clearer expectations. |
| A11y | Accessibility | GovernanceDashboard type label | Use the full word consistently. "A11y" is a developer abbreviation, not a user-facing term. |
| MCP | (keep label, add tooltip) | StatusBar | "MCP" means nothing to designers. Add a tooltip: "Model Context Protocol — the connection between Flint's governance engine and your AI agent." |
| Consensus Gate | AI second opinion | AgentDashboard section | "Consensus Gate" is technical. "AI second opinion" describes the behavior: a second AI reviewed high-risk changes. |
| Disagreement rate | How often the second opinion differed | AgentDashboard | "Disagreement rate" is statistics language. Plain English states the behavior. |

---

## Part 3: Level 1 Design — Specific Tooltip Copy for Every Badge and Chip

Level 1 is the minimum: every governance element that currently has no explanation or only jargon gets a plain-language tooltip. These are short (1–2 sentences). They appear on hover of the element itself, using native HTML `title` attributes where a tooltip library is not warranted, or a small Radix-style popover for richer content.

### Canvas badges (ShieldOverlay)

**Amber badge (warning severity):**
> "This element has style values that don't match your design tokens. It won't block export yet, but should be fixed."

**Red badge (critical severity):**
> "This element has a problem that must be fixed before export — usually a large color difference from your tokens or an accessibility issue."

**Heat tint (amber):**
> No standalone tooltip — the badge tooltip covers it.

**Heat tint (red):**
> No standalone tooltip — the badge tooltip covers it.

**Lock icon:**
> "Being edited by [user name] — you can't make changes until they're done." (when user name is available) / "Being edited by another collaborator." (fallback)

### ViolationTooltip (canvas hover popover)

**ΔE value line:**
Current: `ΔE 4.5 — slightly off` / `ΔE 8.4 — very different from token`
Revised primary text: `This color is slightly off-spec (color distance: 4.5)` / `This color is far from your design token (color distance: 8.4)`
The ΔE number moves to secondary/parenthetical position. The natural language comes first.

**Severity badge inside tooltip:**
"warning" → "Warning — won't block export"
"critical" → "Blocks export"

**Rule ID chip:**
Current: "MITHRIL-COL-001" in mono
Revised: Rule name ("Color drift check") primary, rule ID in secondary mono position for reference
Tooltip on the rule ID chip: "Rule ID — use this when configuring or reporting a specific rule."

**A11y section header:**
Add sub-label: "Accessibility issues block export by default."

### GovernanceOverlay (right sidebar violation list)

**Section header "GOVERNANCE":**
Add secondary label beneath: "Design system checks for the active file."

**"amber" severity badge:**
`title="Warning — this won't block export but should be resolved before ship."`

**"critical" severity badge:**
`title="Blocks export — this must be fixed or overridden before you can export."`

**Auto-Fix button:**
`title="Apply the suggested token replacement. This change is reversible with undo (Cmd+Z)."`

**Configure rule gear icon:**
Replace with text link "Configure rule" (see Level 3 opportunity below). Tooltip on link: "Open rule settings to adjust or disable this check."

### GhostOverlay (hardcoded values card)

**Card header "HARDCODED VALUES":**
Revised: "Style values not from your design system"
Sub-label: "These colors, spacings, or fonts were written directly into the code instead of using your design tokens."

**Footer hint:**
Current: "Replace with the nearest token class to pass the Mithril gate."
Revised: "Replace these values with design tokens to resolve the design drift check and unblock export."

### GovernanceDashboard (Health tab)

**Score ring:**
Add `aria-description` beyond the current `aria-label`. On the score value itself, add a `title` attribute:
`title="Governance health score. 90–100 = A (excellent). 80–89 = B. 70–79 = C. 60–69 = D. Below 60 = F. Accessibility issues count 10 points each; design drift issues count 5 points."`

**Grade letter:**
Add subtitle beneath when grade is not A:
- B: "Good — minor issues present"
- C: "Needs attention — notable drift"
- D: "At risk — significant violations"
- F: "Critical — export likely blocked"

**"Delta Mode" badge:**
Revised: "New issues only"
`title="Only violations added since your baseline snapshot are shown. Click 'Clear Baseline' to see all violations again."`

**"Set Baseline" button:**
`title="Snapshot current violations. After this, only new violations will affect your score — useful when you have known pre-existing issues you're tracking separately."`

**Penalty breakdown rows:**
These rows should be removed and replaced with action-oriented framing (see Level 2 design).

**"Active Overrides" banner:**
Rename to "Unapplied Style Changes" with text: "You've manually changed style values that don't match your design system. Reset or apply the suggested token to unblock export."

**"Top Violated Rules" header:**
Add sub-label: "These rule categories are firing most often in the active file."

### StatusBar chips

**MCP dot + "MCP" label:**
`title="Governance engine — connected. Flint is actively checking your code against your design system."`
When disconnected: `title="Governance engine — not connected. Click 'Reconnect' to restore. Design checks are paused."`

**"Export Ready" chip:**
`title="All design checks are passing. This file is clean and ready to export."`

**"N Mithril Violations" chip:**
Revised label: "N Design Drift Issues"
`title="This file has N style values that don't match your design tokens. Export is blocked. Click to see details."`

**"Overrides Active" chip:**
Revised label: "Unapplied Style Changes"
`title="You've manually changed style values that differ from your design tokens. These must be resolved before export. Click to see what needs fixing."`

**"Overrides (N)" governance rule count:**
Revised label: "Rule customizations (N)"
`title="You've customized N governance rules for this session. These adjustments don't block export — they change which checks run."`

**"Autopilot" button:**
`title="Automatically applies design drift fixes as they appear. Cmd+Shift+G to apply queued fixes. Changes are reversible with undo."`

**Build View / Govern View indicator:**
`title="Build view: browse and compose components. Govern view: see design system health and coverage. Switch with Cmd+1/2/3."`

### AgentDashboard

**Risk indicator dot (colored, no label):**
Add a visible risk tier label next to the dot: "Low" / "Medium" / "High" / "Critical risk"
The existing badge to the right of the agent row already shows this — remove the unlabeled dot and rely on the badge alone.

**"OVR N" chip:**
Revised: "N rule bypasses"
`title="This agent overrode N governance rules during its session — allowing code that would otherwise be flagged."`

**Red/amber/green count chips:**
Add microtext beneath the chip row: "Red = high-risk changes / Amber = reviewed / Green = safe"

**"Consensus Gate" section header:**
Revised: "AI second opinion"
Sub-label: "High-risk changes are reviewed by a second AI model before being applied."

**Disagreement metric:**
Current label: "Disagreement"
Revised: "Differed"
`title="How often the second AI disagreed with the first on whether a change was safe. High rates may indicate the agent is operating outside expected patterns."`

---

## Part 4: Level 2 Design — Expandable Detail Pattern

Level 2 gives users who want more context a way to get it without leaving their current surface. There are two interaction patterns: the expandable violation row and the rule detail popover.

### Pattern A: Expandable violation row (GovernanceOverlay + ExportModal)

Each violation row in GovernanceOverlay and ExportModal gains an expand control — a chevron or "Why?" link. Clicking it expands the row in place to show:

1. **What was detected** (already shown in the collapsed row — no change)
2. **Why this rule exists** — pulled from `errorTaxonomy.ts` `.explanation` field
3. **How to fix it** — pulled from `errorTaxonomy.ts` `.recovery` field
4. **Export consequence** — "This violation blocks export" / "This is a warning — export is not blocked yet"
5. **Configure link** — "Adjust this rule's settings" (opens GovernancePanel to the specific rule)

The expansion is triggered by clicking anywhere on the rule name or a chevron icon. The expanded state is per-row in local React state. Only one row is expanded at a time.

Example expanded state for a color drift violation:

```
Color drift — Warning
#flint-node-btn-primary
This color is 4.2 off-spec from your design token (color distance: 4.2)
Use text-brand-500 (#4f46e5) instead                    [Apply fix]  [Adjust rule]

  v  Why this check exists
     Style values written directly into code rather than pulled from your
     design tokens make future rebrand or theme changes unreliable. Every
     color in a production codebase should trace back to a named token.

     How to fix: Click "Apply fix" to automatically replace this value with
     the nearest token. Or navigate to the element and update it manually
     using the Properties panel.

     Export status: Warning — not blocking export yet. If the color
     distance exceeds 10.0 this will become a blocker.
```

The rule lookup maps violation types to taxonomy entries:
- `color-drift` → FLINT-MITH-001
- `typography-drift` → FLINT-MITH-002 (font family) or FLINT-MITH-003 (size) etc.
- `spacing-drift` → FLINT-MITH-007
- `a11y` → match on A11Y rule ID prefix (A11Y-001 through A11Y-050)

### Pattern B: Rule detail popover (GovernancePanel)

Each rule row in GovernancePanel gets an info icon button (ⓘ) on the right edge of the row. Clicking it opens a small popover anchored to the row:

```
Color drift check  [MITHRIL-COL-001]
Severity: Warning (you can change this)

What this checks:
Detects color values in your code that don't match any design token. Uses
perceptual color science to measure the difference — a distance of 2.0 or
higher triggers a warning.

Why it matters:
Unregistered colors erode brand consistency and make theme changes
unreliable. Every color in production should trace to a named token.

If you disable this:
Color values will no longer be checked against your design system.
Design drift can accumulate undetected.

                                         [Close]  [Adjust severity]
```

The popover pulls content from:
- `.title` → row header
- `.explanation` → "Why it matters" section
- The consequence of disabling is computed from the rule's `defaultSeverity` and export gate logic

### Pattern C: Rule description in GovernancePanel (always-visible)

Below the rule name in each RuleRow, add a one-line description in dim text. This requires adding a `description` field to the `GovernanceRule` type in `governanceRulesManifest.ts` and back-filling it for all rules. This is the always-visible version of the rule explanation — shorter than the popover, always present.

Example:
```
[toggle]  MITHRIL-COL-001           [Warning]
          Color drift check
          Flags colors that differ from your design tokens by more than
          a threshold amount.
```

---

## Part 5: Level 3 Design — Reference / Glossary

Level 3 is the single place in the product where all governance concepts are explained. It should be accessible from multiple entry points but live in one canonical location.

### Location: "Learn" section within the Health tab

The GovernanceDashboard (Health tab) is the most education-appropriate surface in Glass — it's the place a designer goes to understand their project's state. It is also the surface most likely to prompt "what does this mean?" questions.

Add a collapsible "Understanding your score" section at the bottom of GovernanceDashboard, below the existing content. Collapsed by default (one line: "How is your score calculated? Learn more"). Expanded state contains:

**How your score is calculated**
Your governance health score (0–100) measures how closely your code follows your design system. It starts at 100 and decreases for each issue found:
- Design drift issues (color, spacing, type, shadow): -5 points each
- Accessibility issues (missing labels, keyboard traps, contrast): -10 points each
- Unapplied style changes (manual overrides not in design tokens): -3 points each

A score of 90 or above (grade A) means your file is in excellent health. Export is available at any score — but accessibility issues always block export regardless of score.

**What blocks export?**
Export is blocked when:
1. Your file has accessibility violations (required for legal compliance)
2. Your file has unapplied style changes (values manually entered that differ from your design tokens)

Design drift issues (color, spacing, type) warn but don't block export on their own.

**Governance concept glossary**

| Term | What it means |
|------|--------------|
| Design drift | A style value (color, spacing, font) that doesn't match your connected design tokens. Flint measures how different it is using color science. |
| Accessibility check | A WCAG 2.1 guideline your component may be failing — for example, missing alt text, insufficient color contrast, or keyboard navigation issues. |
| Design token | A named, versioned value from your design system — like "brand-primary: #4f46e5." Tokens are the source of truth for your visual language. |
| Export check | Before you can export code, Flint verifies there are no accessibility violations and no unapplied manual style changes. |
| Unapplied style changes | Values you've typed directly into a component that differ from your design token values. These must be replaced with the correct token before export. |
| Rule customizations | Changes you've made to which checks Flint runs, or how strict they are. These don't affect your score or block export — they change what Flint looks for. |
| New issues only | A mode where only violations added since a snapshot point count toward your score. Useful for tracking progress on a large existing codebase. |
| AI second opinion | When an AI agent makes a high-risk code change, a second AI model reviews it independently. The "differed" rate shows how often they disagreed. |

### Entry points to Level 3

Three places in Glass should link to the "Understanding your score" section:

1. The health score ring in GovernanceDashboard — a subtle "?" icon that expands to the glossary
2. The "Export Gate — Blocked" state in ExportModal — a "Why is export blocked?" link below the violation list that scrolls to the glossary entry for "What blocks export?"
3. Any violation row in GovernanceOverlay or ExportModal when expanded (Pattern A) — a "Learn more about governance checks" link at the bottom of the expanded state

---

## Part 6: Opportunities

Numbered, scoped, and complexity-rated. No time estimates. Justin decides sequencing.

---

### OPP-EDU-01: Translate StatusBar chip labels
**Scope:** `StatusBar.tsx` only
**Complexity:** Trivial
**What:**
- "N Mithril Violations" → "N Design Drift Issues"
- "Overrides Active" → "Unapplied Style Changes"
- "Overrides (N)" → "Rule customizations (N)"
- "Autopilot" → keep, but add descriptive tooltip (see Level 1)
**Dependencies:** None. Copy changes only.
**Impact:** The most visible governance elements in Glass use plain English. First impressions improve immediately.

---

### OPP-EDU-02: Add descriptive tooltips to all severity badges
**Scope:** `GovernanceOverlay.tsx`, `ViolationTooltip.tsx`, `GovernanceDashboard.tsx`, `GovernancePanel.tsx`
**Complexity:** Contained (2–3 files, tooltip text additions only)
**What:** Every "amber"/"critical"/"warning"/"critical" severity badge gets a `title` attribute with the Level 1 copy defined in Part 3. Amber → "Warning — won't block export." Critical → "Blocks export — must be fixed or overridden."
**Dependencies:** None. Tooltip text additions.
**Impact:** Removes the most common "what does amber mean?" confusion.

---

### OPP-EDU-03: Translate GhostOverlay header and footer copy
**Scope:** `GhostOverlay.tsx` only
**Complexity:** Trivial
**What:**
- "HARDCODED VALUES" → "Style values not from your design system"
- Add sub-label: "These colors, spacings, or fonts were written directly into the code instead of using your design tokens."
- "Replace with the nearest token class to pass the Mithril gate." → "Replace these values with design tokens to resolve the design drift check and unblock export."
**Dependencies:** None.
**Impact:** GhostOverlay teaches its own purpose instead of requiring prior Flint knowledge.

---

### OPP-EDU-04: Add rule descriptions to GovernancePanel rows
**Scope:** `GovernancePanel.tsx` (RuleRow component), `src/core/governanceRulesManifest.ts`
**Complexity:** Contained
**What:** Add a `description` field to the `GovernanceRule` type. Back-fill one-line descriptions for all rules (can be pulled from `errorTaxonomy.ts` `.title` + first sentence of `.explanation`). Render the description as dim text below the rule name in each RuleRow. Add a "Coming soon" label for `status: 'planned'` rules instead of "In development."
**Dependencies:** `governanceRulesManifest.ts` must be updated. No IPC changes.
**Impact:** GovernancePanel becomes self-explaining. The most common question — "what does this rule actually check?" — is answered inline.

---

### OPP-EDU-05: Add expandable Level 2 detail to GovernanceOverlay rows
**Scope:** `GovernanceOverlay.tsx`
**Complexity:** Contained
**What:** Each violation row gains a chevron or "Why?" expand control. Expanding reveals the taxonomy `explanation` and `recovery` text for that rule, plus the export consequence (blocking or not). The lookup uses the violation type to find the matching taxonomy entry. No new IPC or store slices required — taxonomy is static data importable from `errorTaxonomy.ts`.
**Dependencies:** OPP-EDU-04 is not required but complementary. The taxonomy lookup works independently.
**Impact:** Closes the single biggest learning gap: "I see a violation but I don't know why it matters or how to fix it."

---

### OPP-EDU-06: Add rule detail popover to GovernancePanel
**Scope:** `GovernancePanel.tsx` (RuleRow component, new popover sub-component)
**Complexity:** Contained
**What:** Add an info icon button to each RuleRow. Clicking opens a popover with the taxonomy `explanation`, `recovery`, and a computed consequence of disabling. Pull content from `errorTaxonomy.ts`. No new IPC. Requires a lightweight popover component (can reuse the existing ViolationTooltip pattern).
**Dependencies:** Requires `errorTaxonomy.ts` lookup by `ruleId`. The mapping exists in the taxonomy `ruleId` field.
**Impact:** GovernancePanel becomes a learning surface, not just a toggle panel. Designers can make informed decisions about which rules to adjust.

---

### OPP-EDU-07: Add tab relationship explanation to GovernancePanel
**Scope:** `GovernancePanel.tsx` (tab bar, tab content areas)
**Complexity:** Trivial
**What:** Add one-line subtitles under each tab:
- Rules: "Individual rule adjustments for this project"
- Rule Packs: "Bundles of rules — enabling a pack activates all its rules"
- Profiles: "Compliance frameworks (WCAG, GDPR) — enabling a profile activates its rule pack"
Add a connecting note in the Profiles tab: "Enabling a profile here automatically activates the matching Rule Pack above."
**Dependencies:** None.
**Impact:** The three-level configuration hierarchy becomes legible without documentation.

---

### OPP-EDU-08: Add "Understanding your score" glossary to GovernanceDashboard
**Scope:** `GovernanceDashboard.tsx`
**Complexity:** Contained
**What:** Add a collapsible "How is your score calculated?" section at the bottom of GovernanceDashboard. Static content — no IPC required. Content as specified in Part 5 of this document.
**Dependencies:** None. Static content addition.
**Impact:** Creates Level 3 reference in the most appropriate context. All other education efforts can point here.

---

### OPP-EDU-09: Replace penalty breakdown with action-oriented framing
**Scope:** `GovernanceDashboard.tsx`
**Complexity:** Contained
**What:** Remove the current "Mithril violations × 5 pts / Accessibility violations × 10 pts / Active overrides × 3 pts" penalty breakdown. Replace with: "Fixing the [N] accessibility issues would raise your score by [N×10] points. Fixing the [N] design drift issues would raise it by [N×5] more." The computation is the same — just action-framed rather than formula-displayed.
**Dependencies:** Score computation logic unchanged. UI copy change only.
**Impact:** Turns the most confusing section of the dashboard into a prioritized action list.

---

### OPP-EDU-10: Add ΔE plain-language framing to ViolationTooltip
**Scope:** `ViolationTooltip.tsx`
**Complexity:** Trivial
**What:** In the tooltip's ΔE display line, move natural language to primary position and ΔE number to secondary:
- Current: `ΔE 4.5 — slightly off`
- Revised: `This color is slightly off-spec` with `(color distance: 4.5)` in dim secondary text
The threshold language ("very different," "noticeably different," "slightly off") already exists in the component — just reorder the text.
**Dependencies:** None.
**Impact:** The most technical metric in the product stops leading with a Greek letter.

---

### OPP-EDU-11: Add "Why is export blocked?" explanatory link in ExportModal
**Scope:** `ExportModal.tsx`
**Complexity:** Trivial
**What:** In the blocked export state, add a collapsible "Why is export blocked?" section above the violation list. Expanding reveals: "Flint requires all accessibility issues to be fixed before export. Design drift issues (color, spacing, type) warn but don't block export on their own. Manual style changes that differ from your design tokens also block export until applied."
**Dependencies:** None.
**Impact:** The ExportModal becomes self-explaining for first-time users. Reduces the conceptual overhead of interpreting three violation categories at once.

---

### OPP-EDU-12: Rename ExportModal section headers to plain language
**Scope:** `ExportModal.tsx`
**Complexity:** Trivial
**What:**
- "Mithril Violations (N)" → "Design drift issues (N)"
- "Accessibility Violations (N)" → "Accessibility issues (N)"
- Keep "Property Overrides (N)" → rename to "Unapplied style changes (N)" to match StatusBar terminology (OPP-EDU-01)
**Dependencies:** OPP-EDU-01 for consistency.
**Impact:** ExportModal speaks the same language as StatusBar, reducing confusion from seeing different names for the same concepts.

---

### OPP-EDU-13: Add MCP connection tooltip explaining what MCP is
**Scope:** `StatusBar.tsx` (MCP indicator)
**Complexity:** Trivial
**What:** The MCP dot and label currently show "MCP" with no explanation. Add a tooltip: "Governance engine — this is the connection between Flint's design system checks and your AI coding assistant. When connected, Flint can audit and fix code as it's generated."
**Dependencies:** None.
**Impact:** Non-technical designers understand what the MCP indicator means and why they should care if it's disconnected.

---

### OPP-EDU-14: Add AgentDashboard plain-language framing for risk tiers
**Scope:** `AgentDashboard.tsx`
**Complexity:** Trivial
**What:**
- Rename "Consensus Gate" section to "AI second opinion"
- Add sub-label: "High-risk code changes are reviewed by a second AI model before being applied."
- Add micro-legend below the red/amber/green count chips: "High-risk · Reviewed · Safe"
- "OVR N" chip → "N rule bypasses"
- Rename "Disagreement" metric to "Differed" with tooltip explaining meaning
**Dependencies:** None.
**Impact:** The Agents tab becomes understandable to designers who don't know what "consensus" or "mutation risk scoring" means.

---

### OPP-EDU-15: Add first-occurrence tooltip for the violation badge (OPP-17 implementation)
**Scope:** New `useOnboardingTooltip` hook (if not already built from OPP-17 in UX-OPPORTUNITIES.md), `ShieldOverlay.tsx`
**Complexity:** Moderate
**What:** The first time a violation badge appears on the canvas in a new session, a non-blocking tooltip appears for 6 seconds, then dismisses:
"A design check flagged an issue on this element. Hover the badge to see what it found, or click to go to the Health tab."
Tracked in `localStorage` so it shows at most once per install, not once per session.
**Dependencies:** Requires `useOnboardingTooltip` hook or similar one-time display mechanism. OPP-17 from UX-OPPORTUNITIES.md specifies this infrastructure.
**Impact:** Closes the cold-start gap: the first time a designer sees a violation badge, they know what it means and what to do.

---

## Part 7: Priority Order

Sequenced by: correctness first (things that are wrong), then comprehension (things that are confusing), then depth (things that could be richer).

### Tier 1 — Fix now (correctness failures and highest-traffic elements)

These touch the elements every user encounters on every session.

1. **OPP-EDU-01** — StatusBar chip labels (trivial, zero-risk, maximum exposure)
2. **OPP-EDU-12** — ExportModal section headers to plain language (trivial, blocked-export is high-stakes)
3. **OPP-EDU-02** — Severity badge tooltips everywhere (contained, answers the most-asked question)
4. **OPP-EDU-03** — GhostOverlay copy translation (trivial, eliminates "Mithril gate" jargon from the floating card)

### Tier 2 — Fix next (comprehension gaps in configuration and health surfaces)

5. **OPP-EDU-10** — ΔE plain-language framing in ViolationTooltip (trivial)
6. **OPP-EDU-11** — "Why is export blocked?" section in ExportModal (trivial)
7. **OPP-EDU-09** — Replace penalty breakdown with action framing in GovernanceDashboard (contained)
8. **OPP-EDU-07** — Tab relationship explanation in GovernancePanel (trivial)
9. **OPP-EDU-13** — MCP connection tooltip (trivial)

### Tier 3 — Fix in next sprint (depth and power-user features)

10. **OPP-EDU-04** — Rule descriptions in GovernancePanel rows (contained — requires manifest update)
11. **OPP-EDU-05** — Expandable Level 2 detail in GovernanceOverlay (contained — key education investment)
12. **OPP-EDU-08** — "Understanding your score" glossary in GovernanceDashboard (contained — Level 3 reference)
13. **OPP-EDU-14** — AgentDashboard plain-language framing (trivial)

### Tier 4 — Fix in a structured sprint (requires infrastructure or design decision)

14. **OPP-EDU-06** — Rule detail popover in GovernancePanel (contained — requires popover component)
15. **OPP-EDU-15** — First-occurrence tooltip for violation badge (moderate — requires onboarding hook infrastructure)

---

## Appendix: Source Files Referenced

- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/GovernanceOverlay.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/ShieldOverlay.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/GhostOverlay.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/ViolationTooltip.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernanceDashboard.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernancePanel.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/ExportModal.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/StatusBar.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/AgentDashboard.tsx`
- `/Users/tiemann/Lunar-Elevator-Bridge/flint-mcp/src/core/errorTaxonomy.ts`
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/plans/GOVERNANCE-UX-REVIEW.md`
- `/Users/tiemann/Lunar-Elevator-Bridge/.flint-context/plans/UX-OPPORTUNITIES.md`
