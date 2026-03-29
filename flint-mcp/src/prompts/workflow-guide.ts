/**
 * flint-workflow-guide — interactive multi-tool sequence composition prompt.
 *
 * When a host (Claude Desktop, Cursor, VS Code) loads this prompt, the LLM
 * receives the full Flint tool catalog embedded in its context and is guided
 * to suggest the correct workflow sequence based on the user's stated intent.
 *
 * The prompt is deliberately tool-agnostic in language so it works equally
 * well for first-time users exploring capabilities and experienced agents
 * composing automated governance pipelines.
 */

export const WORKFLOW_GUIDE_PROMPT = {
    name: "flint-workflow-guide",
    description:
        "Interactive guide for composing Flint MCP tool workflows. Helps users understand which tools to chain together for common tasks.",
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
## Flint Tool Reference

### Context tools — read before anything else
| Tool | Purpose |
|------|---------|
| flint_get_context | Active file, selected node, open violations, token snapshot |
| flint_status | Server health and engine readiness check |

### Audit tools — detect violations
| Tool | Purpose |
|------|---------|
| flint_audit | Full Mithril + A11y + domain rule audit on source code |
| audit_ui_component | Convenience wrapper — audits a file by path |

### Fix tools — resolve violations
| Tool | Purpose |
|------|---------|
| flint_fix | Auto-apply high-confidence governance fixes |
| flint_ast_mutate | Surgical AST mutations (the ONLY approved way to modify code) |

### Token tools — design system data
| Tool | Purpose |
|------|---------|
| flint_sync_tokens | Compare or sync Figma tokens with the local token set |
| flint_query_registry | Search component registry for existing design system components |

### Report tools — project-wide visibility
| Tool | Purpose |
|------|---------|
| flint_debt_report | Project-wide design debt summary |
| flint_accessibility_report | WCAG 2.1 / Section 508 VPAT conformance report |

### Governance tools — enforcement and oversight
| Tool | Purpose |
|------|---------|
| flint_consensus_report | Team annotation consensus across agents |
| flint_anomaly_report | Detect governance bypass patterns in telemetry |
| flint_validate_themes | Verify design theme internal consistency |

### Migration tools — large-scale codebase changes
| Tool | Purpose |
|------|---------|
| flint_migrate_ds | Design system migration via AST class replacement |
| flint_migrate_tw | Tailwind version migration (v3 → v4) via AST |

### Platform tools — multi-platform export
| Tool | Purpose |
|------|---------|
| flint_pack_export | Export to React / Vue / iOS / Android with governance gates |

### Collaboration tools — team governance
| Tool | Purpose |
|------|---------|
| flint_defer_violation | Record decisions, debates, or compliance notes on AST nodes |

---

## Readable Resources

| URI | What it contains |
|-----|-----------------|
| flint://capabilities | This catalog — full tools, resources, prompts, and workflows |
| flint://tokens | Current design tokens (DTCG format) — read before generating styled code |
| flint://manifest | Component registry (flint-manifest.json) |
| flint://rules | All active governance rules grouped by domain |
| flint://violations/{filePath} | Live audit for a specific file |
| flint://annotations | All team governance annotations |

---

## Common Workflows

### 1. audit-then-fix (most common)
Use when: you want to check and repair a component.
\`\`\`
flint_get_context → flint_audit → flint_fix → flint_audit (verify)
\`\`\`

### 2. figma-import
Use when: bringing a Figma design into the codebase.
\`\`\`
flint_ingest_figma → flint_sync_tokens → flint_query_registry → flint_ast_mutate → flint_audit
\`\`\`

### 3. new-component
Use when: building a new governed component from scratch.
\`\`\`
flint_get_context → flint_query_registry → flint_audit (draft) → flint_fix → flint_ast_mutate (commit)
\`\`\`

### 4. design-debt-sprint
Use when: starting a design debt reduction effort.
\`\`\`
flint_debt_report → flint_audit (hotspots) → flint_fix → flint_validate_themes
\`\`\`

### 5. pre-release-gate
Use when: final governance check before shipping.
\`\`\`
flint_audit (severity: critical) → flint_validate_themes (strict) → flint_accessibility_report → flint_pack_export
\`\`\`

### 6. token-migration
Use when: migrating from hardcoded values or a legacy design system.
\`\`\`
flint_sync_tokens (diff-only) → flint_sync_tokens (write) → flint_migrate_ds → flint_audit
\`\`\`

### 7. collaborative-review
Use when: coordinating a governance review across a team.
\`\`\`
flint_audit → flint_defer_violation → flint_consensus_report → flint_fix
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

    return `You are the Flint Workflow Guide — a specialist in composing multi-tool Flint MCP sequences.

Your role is to help users and AI agents:
1. Understand what Flint MCP tools exist and what each one does.
2. Identify the correct workflow sequence for their stated goal.
3. Explain the governance rules that make each step mandatory.

HARD RULES you must enforce in every response:
- Always recommend reading flint://tokens BEFORE generating any styled code.
- Always recommend flint_query_registry BEFORE drafting new components.
- Never suggest skipping flint_audit before committing code changes.
- flint_ast_mutate is the ONLY approved way to modify source code — never suggest raw string replacement or regex edits.
- If flint_audit returns critical violations, the workflow must pause until they are resolved.

---

${intentBlock}

---

${TOOL_REFERENCE}

---

When the user states their goal, map it to the closest workflow above, then walk through each step explaining:
- What the tool does at that point in the sequence.
- What the expected output looks like.
- What to check before proceeding to the next step.

If the goal doesn't match any preset workflow, compose a custom sequence using the tool reference table, starting with flint_get_context and ending with flint_audit to verify the result.`;
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
            ["flint_ingest_figma", "flint_sync_tokens", "flint_query_registry", "flint_ast_mutate", "flint_audit"],
        );
    }

    if (containsAny(lower, ["audit", "check", "validate", "lint", "review"])) {
        return recommendWorkflow(
            "audit-then-fix",
            "You want to audit and repair a component.",
            ["flint_get_context", "flint_audit", "flint_fix", "flint_audit"],
        );
    }

    if (containsAny(lower, ["new component", "create component", "build component", "draft component"])) {
        return recommendWorkflow(
            "new-component",
            "You want to build a new governed component from scratch.",
            ["flint_get_context", "flint_query_registry", "flint_audit", "flint_fix", "flint_ast_mutate"],
        );
    }

    if (containsAny(lower, ["debt", "drift", "token drift", "violations report", "sprint"])) {
        return recommendWorkflow(
            "design-debt-sprint",
            "You want to reduce design debt across the project.",
            ["flint_debt_report", "flint_audit", "flint_fix", "flint_validate_themes"],
        );
    }

    if (containsAny(lower, ["release", "ship", "export", "gate", "vpat", "508", "wcag", "accessibility report"])) {
        return recommendWorkflow(
            "pre-release-gate",
            "You want to run the final governance check before a release.",
            ["flint_audit", "flint_validate_themes", "flint_accessibility_report", "flint_pack_export"],
        );
    }

    if (containsAny(lower, ["migrate", "migration", "tailwind", "tw4", "tw3", "design system change"])) {
        return recommendWorkflow(
            "token-migration",
            "You want to migrate to a new design system or Tailwind version.",
            ["flint_sync_tokens", "flint_migrate_ds", "flint_audit"],
        );
    }

    if (containsAny(lower, ["annotate", "annotation", "review", "team", "collab", "consensus", "debate"])) {
        return recommendWorkflow(
            "collaborative-review",
            "You want to coordinate a governance review across your team.",
            ["flint_audit", "flint_defer_violation", "flint_consensus_report", "flint_fix"],
        );
    }

    return `User intent: "${intent}"\n\nNo exact workflow match found. Compose a custom sequence starting with flint_get_context to establish project context, then refer to the tool reference below to build the appropriate chain for this goal.`;
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
