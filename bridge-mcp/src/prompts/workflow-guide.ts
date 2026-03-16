/**
 * bridge-workflow-guide — interactive multi-tool sequence composition prompt.
 *
 * When a host (Claude Desktop, Cursor, VS Code) loads this prompt, the LLM
 * receives the full Bridge tool catalog embedded in its context and is guided
 * to suggest the correct workflow sequence based on the user's stated intent.
 *
 * The prompt is deliberately tool-agnostic in language so it works equally
 * well for first-time users exploring capabilities and experienced agents
 * composing automated governance pipelines.
 */

export const WORKFLOW_GUIDE_PROMPT = {
    name: "bridge-workflow-guide",
    description:
        "Interactive guide for composing Bridge MCP tool workflows. Helps users understand which tools to chain together for common tasks.",
    arguments: [
        {
            name: "intent",
            description:
                "Optional natural-language description of what the user is trying to accomplish (e.g. 'import a Figma design', 'fix accessibility violations'). When provided, the guide opens with a focused workflow recommendation before showing the full reference.",
            required: false,
        },
    ],
} as const;

// ---------------------------------------------------------------------------
// Inline catalog for the prompt body
// Kept as a plain string to avoid a runtime import cycle with the resource
// handler and to ensure the prompt body is self-contained.
// ---------------------------------------------------------------------------

const TOOL_REFERENCE = `
## Bridge Tool Reference

### Context tools — read before anything else
| Tool | Purpose |
|------|---------|
| bridge_get_context | Active file, selected node, open violations, token snapshot |
| bridge_status | Server health and engine readiness check |

### Audit tools — detect violations
| Tool | Purpose |
|------|---------|
| bridge_audit | Full Mithril + A11y + domain rule audit on source code |
| audit_ui_component | Convenience wrapper — audits a file by path |

### Fix tools — resolve violations
| Tool | Purpose |
|------|---------|
| bridge_fix | Auto-apply high-confidence governance fixes |
| bridge_ast_mutate | Surgical AST mutations (the ONLY approved way to modify code) |

### Token tools — design system data
| Tool | Purpose |
|------|---------|
| bridge_sync_tokens | Compare or sync Figma tokens with the local token set |
| bridge_query_registry | Search component registry for existing design system components |

### Report tools — project-wide visibility
| Tool | Purpose |
|------|---------|
| bridge_debt_report | Project-wide design debt summary |
| bridge_vpat_report | WCAG 2.1 / Section 508 VPAT conformance report |

### Governance tools — enforcement and oversight
| Tool | Purpose |
|------|---------|
| bridge_consensus_status | Team annotation consensus across agents |
| bridge_anomaly_report | Detect governance bypass patterns in telemetry |
| bridge_theme_validate | Verify design theme internal consistency |

### Migration tools — large-scale codebase changes
| Tool | Purpose |
|------|---------|
| bridge_migrate_ds | Design system migration via AST class replacement |
| bridge_migrate_tw | Tailwind version migration (v3 → v4) via AST |

### Platform tools — multi-platform export
| Tool | Purpose |
|------|---------|
| bridge_platform_export | Export to React / Vue / iOS / Android with governance gates |

### Collaboration tools — team governance
| Tool | Purpose |
|------|---------|
| bridge_annotate | Record decisions, debates, or compliance notes on AST nodes |

---

## Readable Resources

| URI | What it contains |
|-----|-----------------|
| bridge://capabilities | This catalog — full tools, resources, prompts, and workflows |
| bridge://tokens | Current design tokens (DTCG format) — read before generating styled code |
| bridge://manifest | Component registry (bridge-manifest.json) |
| bridge://rules | All active governance rules grouped by domain |
| bridge://violations/{filePath} | Live audit for a specific file |
| bridge://annotations | All team governance annotations |

---

## Common Workflows

### 1. audit-then-fix (most common)
Use when: you want to check and repair a component.
\`\`\`
bridge_get_context → bridge_audit → bridge_fix → bridge_audit (verify)
\`\`\`

### 2. figma-import
Use when: bringing a Figma design into the codebase.
\`\`\`
bridge_ingest_figma → bridge_sync_tokens → bridge_query_registry → bridge_ast_mutate → bridge_audit
\`\`\`

### 3. new-component
Use when: building a new governed component from scratch.
\`\`\`
bridge_get_context → bridge_query_registry → bridge_audit (draft) → bridge_fix → bridge_ast_mutate (commit)
\`\`\`

### 4. design-debt-sprint
Use when: starting a design debt reduction effort.
\`\`\`
bridge_debt_report → bridge_audit (hotspots) → bridge_fix → bridge_theme_validate
\`\`\`

### 5. pre-release-gate
Use when: final governance check before shipping.
\`\`\`
bridge_audit (severity: critical) → bridge_theme_validate (strict) → bridge_vpat_report → bridge_platform_export
\`\`\`

### 6. token-migration
Use when: migrating from hardcoded values or a legacy design system.
\`\`\`
bridge_sync_tokens (diff-only) → bridge_sync_tokens (write) → bridge_migrate_ds → bridge_audit
\`\`\`

### 7. collaborative-review
Use when: coordinating a governance review across a team.
\`\`\`
bridge_audit → bridge_annotate → bridge_consensus_status → bridge_fix
\`\`\`
`.trim();

// ---------------------------------------------------------------------------
// Prompt body
// ---------------------------------------------------------------------------

/**
 * Build the full workflow guide prompt content.
 *
 * @param intent - Optional user-supplied intent string. When provided the
 *   guide will open with a focused suggestion for the best matching workflow
 *   before showing the full reference.
 */
export function getWorkflowGuideContent(intent?: string): string {
    const intentBlock = intent
        ? buildIntentRecommendation(intent)
        : "No specific intent provided — here is the complete workflow reference. Ask the user what they are trying to accomplish and recommend the matching workflow from the list below.";

    return `You are the Bridge Workflow Guide — a specialist in composing multi-tool Bridge MCP sequences.

Your role is to help users and AI agents:
1. Understand what Bridge MCP tools exist and what each one does.
2. Identify the correct workflow sequence for their stated goal.
3. Explain the governance rules that make each step mandatory.

HARD RULES you must enforce in every response:
- Always recommend reading bridge://tokens BEFORE generating any styled code.
- Always recommend bridge_query_registry BEFORE drafting new components.
- Never suggest skipping bridge_audit before committing code changes.
- bridge_ast_mutate is the ONLY approved way to modify source code — never suggest raw string replacement or regex edits.
- If bridge_audit returns critical violations, the workflow must pause until they are resolved.

---

${intentBlock}

---

${TOOL_REFERENCE}

---

When the user states their goal, map it to the closest workflow above, then walk through each step explaining:
- What the tool does at that point in the sequence.
- What the expected output looks like.
- What to check before proceeding to the next step.

If the goal doesn't match any preset workflow, compose a custom sequence using the tool reference table, starting with bridge_get_context and ending with bridge_audit to verify the result.`;
}

// ---------------------------------------------------------------------------
// Intent matcher
// ---------------------------------------------------------------------------

/**
 * Given a user intent string, return a focused recommendation block.
 * Keeps logic simple and deterministic — no AI calls, pure string matching.
 */
function buildIntentRecommendation(intent: string): string {
    const lower = intent.toLowerCase();

    if (containsAny(lower, ["figma", "import", "design intent", "sdi", "ingest"])) {
        return recommendWorkflow(
            "figma-import",
            "You want to bring a Figma design into the codebase.",
            ["bridge_ingest_figma", "bridge_sync_tokens", "bridge_query_registry", "bridge_ast_mutate", "bridge_audit"],
        );
    }

    if (containsAny(lower, ["audit", "check", "validate", "lint", "review"])) {
        return recommendWorkflow(
            "audit-then-fix",
            "You want to audit and repair a component.",
            ["bridge_get_context", "bridge_audit", "bridge_fix", "bridge_audit"],
        );
    }

    if (containsAny(lower, ["new component", "create component", "build component", "draft component"])) {
        return recommendWorkflow(
            "new-component",
            "You want to build a new governed component from scratch.",
            ["bridge_get_context", "bridge_query_registry", "bridge_audit", "bridge_fix", "bridge_ast_mutate"],
        );
    }

    if (containsAny(lower, ["debt", "drift", "token drift", "violations report", "sprint"])) {
        return recommendWorkflow(
            "design-debt-sprint",
            "You want to reduce design debt across the project.",
            ["bridge_debt_report", "bridge_audit", "bridge_fix", "bridge_theme_validate"],
        );
    }

    if (containsAny(lower, ["release", "ship", "export", "gate", "vpat", "508", "wcag", "accessibility report"])) {
        return recommendWorkflow(
            "pre-release-gate",
            "You want to run the final governance check before a release.",
            ["bridge_audit", "bridge_theme_validate", "bridge_vpat_report", "bridge_platform_export"],
        );
    }

    if (containsAny(lower, ["migrate", "migration", "tailwind", "tw4", "tw3", "design system change"])) {
        return recommendWorkflow(
            "token-migration",
            "You want to migrate to a new design system or Tailwind version.",
            ["bridge_sync_tokens", "bridge_migrate_ds", "bridge_audit"],
        );
    }

    if (containsAny(lower, ["annotate", "annotation", "review", "team", "collab", "consensus", "debate"])) {
        return recommendWorkflow(
            "collaborative-review",
            "You want to coordinate a governance review across your team.",
            ["bridge_audit", "bridge_annotate", "bridge_consensus_status", "bridge_fix"],
        );
    }

    return `User intent: "${intent}"\n\nNo exact workflow match found. Compose a custom sequence starting with bridge_get_context to establish project context, then refer to the tool reference below to build the appropriate chain for this goal.`;
}

function recommendWorkflow(
    name: string,
    rationale: string,
    steps: string[],
): string {
    const stepList = steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
    return `Recommended workflow: **${name}**\nRationale: ${rationale}\n\nSuggested step sequence:\n${stepList}\n\nSee the full workflow reference below for parameter details.`;
}

function containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
}
