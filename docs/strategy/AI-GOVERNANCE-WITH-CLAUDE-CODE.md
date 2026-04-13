# AI Governance for UI Development with Claude Code

A practical guide to enforcing custom component library usage, design token compliance, and Spec-Driven Design (SDD) workflows using Claude Code's built-in primitives.

---

## The Core Idea

When AI agents generate UI code, they need guardrails. Without them, you get hardcoded colors, inconsistent components, missing accessibility, and code that ignores your design system.

The solution has four layers, each adding more enforcement:

| Layer | What it does | Enforcement level | Setup effort |
|-------|-------------|-------------------|--------------|
| CLAUDE.md | Defines the rules | Soft (AI follows instructions) | 30 minutes |
| Skills | Standardizes the SDD workflow | Medium (step-by-step process) | 1-2 hours |
| Hooks | Blocks violations | Hard (deterministic gate) | 1-2 hours |
| MCP Server | Custom validation engine | Full (programmatic) | 1-2 days |

Start with layers 1-3. Add layer 4 only if you need custom validation logic beyond what a shell script can check.

---

## Layer 1: CLAUDE.md (Your Policy Engine)

Create a `CLAUDE.md` file in the root of your project. Claude Code reads this automatically at the start of every conversation.

### File: `CLAUDE.md`

```markdown
# Project: [Your Project Name]

## Development Methodology: Spec-Driven Design (SDD)

All UI work follows the SDD workflow. No component is built without an approved spec. No code is written before the spec is reviewed. The spec is the contract between design intent and implementation.

### SDD Phases

1. **Spec** — Write or review a component spec before any implementation
2. **Design** — Validate that the spec covers all states, variants, tokens, and accessibility
3. **Implement** — Build the component against the spec (the spec is the acceptance criteria)
4. **Verify** — Confirm the implementation matches the spec exactly

### SDD Rules

- NEVER write a new component without a spec file in `specs/components/`
- NEVER deviate from the spec during implementation without updating the spec first
- If the spec is incomplete (missing states, edge cases, tokens), fix the spec before coding
- Specs are the single source of truth — if the code doesn't match the spec, the code is wrong

## Component Library

This project uses a custom component library. All UI must be built with these components.

### Library Location

- Components: `src/lib/components/`
- Component index: `src/lib/components/index.ts`
- Specs: `specs/components/`

### Using the Library

- ALWAYS check the component index before creating anything new
- ALWAYS import from the library barrel (`@lib/components`) — never from internal paths
- DO NOT use raw HTML elements when a library component exists
- DO NOT install third-party UI libraries (no MUI, no shadcn, no Chakra)
- DO NOT create one-off components that duplicate library functionality
- When composing, use existing library primitives as building blocks

### Adding to the Library

New library components require:
1. An approved spec in `specs/components/ComponentName.spec.md`
2. The component file in `src/lib/components/ComponentName/`
3. Co-located tests in `src/lib/components/ComponentName/ComponentName.test.tsx`
4. Export from the barrel file
5. A Storybook story (if applicable)

## Design Tokens

All visual styling must use design tokens. Never hardcode visual values.

### Token Access

Tokens are accessed via [your token system — CSS variables, theme object, etc.]:

| Property | Use this | Not this |
|----------|---------|----------|
| Colors | `var(--color-primary)` | `"#1976d2"` |
| Spacing | `var(--space-4)` | `"16px"` |
| Typography | `var(--font-heading-md)` | `"font-size: 20px"` |
| Border radius | `var(--radius-md)` | `"8px"` |
| Shadows | `var(--shadow-md)` | `"box-shadow: 0 2px 4px..."` |

(Adjust the token format above to match your actual system — CSS variables, theme object, Tailwind config, etc.)

### Where tokens live

- Token definitions: `src/lib/tokens/`
- Token documentation: `specs/tokens/`

## Accessibility Requirements

- Every interactive element must have an accessible name (aria-label or visible label)
- Every form input must have a visible label
- Color contrast must meet WCAG AA (4.5:1 for text, 3:1 for large text)
- Tab order must be logical — no positive tabIndex values
- Loading and error states must be announced to screen readers
- All accessibility requirements must be documented in the component spec

## File Conventions

- Library components: `src/lib/components/<ComponentName>/`
- App-level compositions: `src/components/<domain>/ComponentName.tsx`
- Component specs: `specs/components/ComponentName.spec.md`
- Tests co-located with components
- Barrel exports from each directory's `index.ts`
```

### How to customize this

Replace the bracketed placeholders and example token patterns with your actual:
- Component library location and import patterns
- Token access system (CSS vars, theme object, Tailwind, etc.)
- File structure conventions
- Spec file format and location

---

## Layer 2: Skills (Your SDD Workflow)

Skills are markdown files that inject step-by-step instructions when invoked. They live in `.claude/skills/` in your project.

### File: `.claude/skills/spec.md`

This is the starting point for all new UI work. Spec first, code second.

```markdown
---
name: spec
description: Write or review a component spec following SDD methodology
---

# Spec-Driven Design: Write a Component Spec

Before writing any implementation code, create the spec. The spec is the contract.

## Step 1: Understand the requirement

- What problem does this component solve?
- Who uses it? (end users, other developers composing it, both?)
- Where does it appear in the application?

## Step 2: Check existing components

- Read `src/lib/components/index.ts` for the current library inventory
- Search for components with similar names or purposes
- If something exists that covers 80% of the need, consider extending it and update its spec instead

## Step 3: Write the spec

Create `specs/components/ComponentName.spec.md` with this structure:

```
# ComponentName

## Purpose
One sentence: what this component does and why it exists.

## Props / API
| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|

## States
- Default
- Hover
- Focus
- Active / Pressed
- Disabled
- Loading (if applicable)
- Error (if applicable)
- Empty (if applicable)

## Variants
List each visual variant (size, color, style) with when to use it.

## Design Tokens Used
| Token | Property | Value |
|-------|----------|-------|
List every token this component references.

## Accessibility
- Role and ARIA attributes
- Keyboard interaction pattern
- Screen reader announcement behavior
- Focus management

## Composition
- What library primitives does this build on?
- Can this be composed into larger patterns? Which ones?

## Edge Cases
- Max content length
- Overflow behavior
- RTL support (if applicable)
- Responsive behavior
```

## Step 4: Review the spec

Before marking the spec complete, verify:
- [ ] Every state is documented
- [ ] Every variant has a use case
- [ ] All tokens are listed (no "TBD" entries)
- [ ] Accessibility section is complete
- [ ] Edge cases are addressed
- [ ] Composition relationships are clear

Present the spec to the user for review before proceeding to implementation.
```

### File: `.claude/skills/build.md`

This skill is used after a spec is approved. It implements the component against the spec.

```markdown
---
name: build
description: Implement a component from its approved spec following SDD methodology
---

# SDD Build: Implement from Spec

A spec must exist before implementation begins. If no spec exists, stop and run `/spec` first.

## Step 1: Read the spec

- Read the spec file from `specs/components/ComponentName.spec.md`
- This is your acceptance criteria. Every prop, state, variant, token, and accessibility requirement in the spec must be reflected in the code.

## Step 2: Read the library context

- Read `src/lib/components/index.ts` for available primitives
- Read `src/lib/tokens/` for available token values
- Identify which existing components this new component builds on (from the spec's Composition section)

## Step 3: Implement

- Create the component at the location defined in the file conventions
- Import ONLY from the library barrel or approved packages
- Use ONLY tokens listed in the spec — no hardcoded visual values
- Implement ALL states documented in the spec
- Implement ALL variants documented in the spec
- Add ALL accessibility attributes documented in the spec

## Step 4: Write tests

Write tests that validate the spec:
- One test per state (default, hover, focus, disabled, loading, error, empty)
- One test per variant
- One test per accessibility requirement (aria attributes present, keyboard nav works)
- One test per edge case from the spec

## Step 5: Spec compliance check

Re-read the spec and compare it against the implementation:
- [ ] Every prop from the spec exists in the component
- [ ] Every state from the spec is handled
- [ ] Every variant from the spec is implemented
- [ ] Every token from the spec is used (no extras, no missing)
- [ ] Every accessibility requirement from the spec is in the code
- [ ] Every edge case from the spec is addressed
- [ ] Tests cover every section of the spec

Present a compliance summary to the user: what matches, what's missing, what was added beyond the spec (and why).
```

### File: `.claude/skills/review-ui.md`

For auditing existing components against library and token standards.

```markdown
---
name: review-ui
description: Review a UI component for design system and spec compliance
---

# UI Compliance Review

Review the specified component for design system violations and spec adherence.

## Check 1: Spec exists

- Does a spec file exist at `specs/components/ComponentName.spec.md`?
- If not, flag this as the first issue — no spec means no contract

## Check 2: Spec compliance (if spec exists)

- Compare props in code vs. props in spec
- Compare states handled in code vs. states in spec
- Compare tokens used in code vs. tokens in spec
- Flag any deviation in either direction (missing or extra)

## Check 3: Component library compliance

- List every HTML element used — flag any that should be a library component
- List every third-party import — flag any unapproved libraries
- Check for custom implementations that duplicate library functionality

## Check 4: Design token compliance

- Search for hardcoded hex colors (pattern: `#[0-9a-fA-F]{3,8}`)
- Search for hardcoded pixel values that should use token variables
- Search for inline styles with literal values
- Search for hardcoded font sizes, font weights, font families

## Check 5: Accessibility

- Every interactive element has an accessible name
- Every image has meaningful alt text
- Every form input has a label
- No `outline: none` without a visible focus replacement
- Keyboard navigation is logical

## Output format

Present findings as a checklist:
- [x] PASS — Spec exists and is current
- [x] PASS — Component library compliance
- [ ] VIOLATION — Hardcoded color "#ff0000" on line 42
- [ ] DEVIATION — Spec lists "loading" state but component doesn't handle it
- [ ] MISSING — No accessibility section in spec

For each issue, state: what it is, where it is, and how to fix it.
```

### How to use skills

In Claude Code, type:
- `/spec a date range picker for the reports filter bar` — writes the spec first
- `/build DateRangePicker` — implements from the approved spec
- `/review-ui src/lib/components/DateRangePicker/DateRangePicker.tsx` — audits compliance

The flow is always: **spec → review spec → build → review build**.

---

## Layer 3: Hooks (Your Enforcement Gate)

Hooks are shell commands that run automatically when Claude Code performs tool calls. They can **block** actions that violate your rules.

### Setup: `.claude/settings.json`

Add this to your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolCall": [
      {
        "matcher": "Write|Edit",
        "command": "node .claude/hooks/check-design-tokens.js \"$TOOL_INPUT\"",
        "blocking": true
      },
      {
        "matcher": "Write",
        "command": "node .claude/hooks/check-spec-exists.js \"$TOOL_INPUT\"",
        "blocking": true
      }
    ]
  }
}
```

### File: `.claude/hooks/check-design-tokens.js`

```javascript
#!/usr/bin/env node

/**
 * Post-write hook: checks for hardcoded design values in UI files.
 * Exits non-zero to BLOCK the write if violations are found.
 *
 * Customize the patterns and thresholds for your project.
 */

const fs = require('fs');

// Parse the tool input to get the file path
let filePath;
try {
  const input = JSON.parse(process.argv[2] || '{}');
  filePath = input.file_path || input.path;
} catch {
  process.exit(0);
}

// Only check UI files (adjust extensions/paths for your project)
if (!filePath) process.exit(0);
if (!filePath.match(/\.(tsx|jsx)$/)) process.exit(0);
if (filePath.includes('node_modules')) process.exit(0);
if (filePath.includes('.test.')) process.exit(0);
if (filePath.includes('.stories.')) process.exit(0);

// Read the file
let content;
try {
  content = fs.readFileSync(filePath, 'utf8');
} catch {
  process.exit(0);
}

const violations = [];

// --- Customize these rules for your token system ---

// Rule 1: Hardcoded hex colors
const hexPattern = /(?:color|background|border|fill|stroke)\s*[:=]\s*['"`]#[0-9a-fA-F]{3,8}['"`]/g;
let match;
while ((match = hexPattern.exec(content)) !== null) {
  const line = content.substring(0, match.index).split('\n').length;
  violations.push(`Line ${line}: Hardcoded color — ${match[0].trim()} — use a design token`);
}

// Rule 2: Hardcoded pixel values in style properties
const pxInStyle = /(?:padding|margin|gap|width|height|fontSize|borderRadius)\s*:\s*['"`]?\d+px['"`]?/g;
while ((match = pxInStyle.exec(content)) !== null) {
  const line = content.substring(0, match.index).split('\n').length;
  violations.push(`Line ${line}: Hardcoded px value — ${match[0].trim()} — use a spacing token`);
}

// Rule 3: Hardcoded RGB/HSL colors
const colorFn = /(?:rgb|hsl)a?\(\s*\d+/g;
while ((match = colorFn.exec(content)) !== null) {
  const line = content.substring(0, match.index).split('\n').length;
  violations.push(`Line ${line}: Hardcoded color function — use a design token`);
}

// Rule 4: Raw HTML elements that should be library components
// (customize this list for your library's component names)
const rawElements = [
  { pattern: /<button[\s>]/gi, suggestion: 'Use <Button> from your component library' },
  { pattern: /<input[\s>]/gi, suggestion: 'Use your library\'s input component' },
  { pattern: /<select[\s>]/gi, suggestion: 'Use your library\'s select component' },
  { pattern: /<textarea[\s>]/gi, suggestion: 'Use your library\'s textarea component' },
];

for (const { pattern, suggestion } of rawElements) {
  while ((match = pattern.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    violations.push(`Line ${line}: Raw HTML element — ${suggestion}`);
  }
}

// --- Report results ---

if (violations.length > 0) {
  console.error('\n--- Design System Violations Detected ---\n');
  console.error(`File: ${filePath}\n`);
  violations.forEach(v => console.error(`  VIOLATION: ${v}`));
  console.error(`\n${violations.length} violation(s) found. Fix these before proceeding.\n`);
  console.error('Use design tokens for all visual values.');
  console.error('Use library components instead of raw HTML elements.\n');
  process.exit(1); // BLOCK the write
}

process.exit(0); // Allow the write
```

### File: `.claude/hooks/check-spec-exists.js`

This hook enforces the SDD rule: no new library component without a spec.

```javascript
#!/usr/bin/env node

/**
 * Post-write hook: when creating a new library component file,
 * checks that a corresponding spec exists.
 * Exits non-zero to BLOCK the write if no spec is found.
 *
 * Adjust the paths to match your project structure.
 */

const fs = require('fs');
const path = require('path');

let filePath;
try {
  const input = JSON.parse(process.argv[2] || '{}');
  filePath = input.file_path || input.path;
} catch {
  process.exit(0);
}

if (!filePath) process.exit(0);

// Only enforce on library component files (adjust path for your project)
// This checks: is this a new file inside the component library directory?
const libComponentDir = 'src/lib/components'; // <-- adjust this
if (!filePath.includes(libComponentDir)) process.exit(0);
if (filePath.includes('.test.')) process.exit(0);
if (filePath.includes('.stories.')) process.exit(0);
if (filePath.endsWith('index.ts')) process.exit(0);

// Extract component name from path
// e.g., src/lib/components/DatePicker/DatePicker.tsx → DatePicker
const parts = filePath.split(path.sep);
const libIndex = parts.indexOf('components');
if (libIndex === -1 || libIndex + 1 >= parts.length) process.exit(0);
const componentName = parts[libIndex + 1];

// Check for a spec file
const specPath = path.join('specs', 'components', `${componentName}.spec.md`);
if (!fs.existsSync(specPath)) {
  console.error(`\n--- SDD Violation: Missing Spec ---\n`);
  console.error(`Component: ${componentName}`);
  console.error(`Expected spec at: ${specPath}\n`);
  console.error(`SDD requires a spec before implementation.`);
  console.error(`Write the spec first, then build the component.\n`);
  process.exit(1); // BLOCK — no spec, no code
}

process.exit(0);
```

### How hooks work at runtime

```
Agent tries to write a library component file
        |
        v
Hook 1: check-spec-exists.js — does a spec file exist for this component?
        |
        +-- No spec --> BLOCKED. Agent must write the spec first.
        |
        +-- Spec exists --> continues
                |
                v
Hook 2: check-design-tokens.js — are there hardcoded visual values?
        |
        +-- No violations --> write succeeds
        |
        +-- Violations found --> BLOCKED. Agent self-corrects and retries.
```

The agent cannot bypass these checks. They are external, deterministic enforcement — the rules live outside the AI, not inside it.

### Customizing the hooks

- **Token patterns** — adjust the regex rules in `check-design-tokens.js` to match your token system (CSS variables, theme object, Tailwind classes)
- **Library path** — change `src/lib/components` in `check-spec-exists.js` to match your actual library location
- **Spec location** — change `specs/components/` to wherever your specs live
- **Raw elements** — update the HTML element list to match your library's component names
- **Severity** — set `"blocking": false` in settings.json to warn without blocking

---

## Layer 4: MCP Server (Advanced — Optional)

If you need validation logic more sophisticated than regex — AST-level analysis, cross-file checks, spec-to-code comparison, or integration with external systems — build a small MCP server.

### When you need this

- Semantic spec compliance checking (did the component implement all states from the spec?)
- Cross-file validation (is every library component exported from the barrel?)
- Token usage analysis that understands your custom token resolution system
- Integration with Figma, Storybook, or a design token service

### Minimal structure

```
my-governance-mcp/
  package.json
  src/
    server.ts       # MCP tool and resource registrations
    rules/
      tokens.ts     # Token validation logic
      components.ts # Library compliance checks
      specs.ts      # Spec-to-code comparison
```

### What it exposes

```
Tools:
  validate_component  — full audit of a component against its spec
  check_tokens        — token violation scan with AST-level precision
  suggest_component   — "I need a date picker" → returns your library's answer
  get_spec            — returns the spec for a component so the AI builds against it

Resources:
  team://components   — your component library inventory
  team://tokens       — your current design token values
  team://specs        — index of all component specs and their status
```

### Connecting it to Claude Code

In `.claude/settings.json`:

```json
{
  "mcpServers": {
    "my-governance": {
      "command": "node",
      "args": ["./my-governance-mcp/dist/server.js"]
    }
  }
}
```

The agent discovers the tools automatically and uses them as part of its workflow.

---

## Putting It All Together

### The SDD flow with governance

```
/spec         User describes a component
                |
                v
              Agent writes the spec (states, variants, tokens, a11y, edge cases)
                |
                v
              User reviews and approves the spec
                |
                v
/build        Agent reads the approved spec
                |
                v
              Agent reads library components and tokens (because the skill told it to)
                |
                v
              Agent implements against the spec
                |
                v
              Hook: does the spec exist? (yes — already approved)
              Hook: any hardcoded values? (blocks if found, agent self-corrects)
                |
                v
              Agent writes tests covering every spec section
                |
                v
/review-ui    Agent audits: code vs. spec, tokens, library compliance, a11y
                |
                v
              Compliant component, verified against the spec
```

### Why SDD + governance layers work well together

The spec is the **contract**. The skills enforce the **process** (spec first, then build). The hooks enforce the **standards** (tokens, library usage). Together:

- The spec prevents the AI from improvising requirements
- The build skill prevents the AI from ignoring the spec
- The hooks prevent the AI from cutting corners on tokens and library usage
- The review skill catches anything that slipped through

### Implementation order

```
Week 1:  Write CLAUDE.md with your library rules, token system, and SDD methodology
         This alone will noticeably improve AI output quality.

Week 1:  Create the /spec, /build, and /review-ui skills
         Now the SDD workflow is standardized and repeatable.

Week 2:  Add the post-write hooks for token enforcement and spec-exists checks
         Now violations are blocked, not just discouraged.

Later:   Build an MCP server if you hit the limits of regex-based checking
         Most teams won't need this for a while.
```

### Quick reference: file locations

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project root — library rules, token system, SDD methodology |
| `.claude/settings.json` | Hook configuration |
| `.claude/skills/spec.md` | SDD Phase 1: write a component spec |
| `.claude/skills/build.md` | SDD Phase 3: implement from approved spec |
| `.claude/skills/review-ui.md` | Audit a component for compliance |
| `.claude/hooks/check-design-tokens.js` | Post-write gate: blocks hardcoded values |
| `.claude/hooks/check-spec-exists.js` | Post-write gate: blocks library components without specs |
| `specs/components/` | Component spec files (the contracts) |

---

## Adapting for Your Project

Before using this guide, customize:

1. **Component library paths** — Replace `src/lib/components/` with your actual library location
2. **Token access patterns** — Replace the CSS variable examples with however your system exposes tokens (theme object, Tailwind classes, SCSS variables, etc.)
3. **Spec format** — Adjust the spec template to match your team's existing documentation standards
4. **Hook rules** — Update regex patterns to match your token naming conventions
5. **Accessibility requirements** — Add any organization-specific standards beyond WCAG AA
6. **File conventions** — Match your actual project structure and naming patterns

The patterns are universal. The details are yours.
