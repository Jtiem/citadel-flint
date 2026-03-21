import path from "node:path";
import type { LinterWarning, DesignToken } from "../types.js";
import type { A11yAuditResult } from "./a11y/types.js";

// ---------------------------------------------------------------------------
// formatAuditReport — Governance Dashboard
// ---------------------------------------------------------------------------

export function formatAuditReport(
    componentPath: string,
    mithrilWarnings: Map<string, LinterWarning>,
    a11yResult: A11yAuditResult,
    tokens: DesignToken[],
    displayFile?: string
): string {
    const basename = path.basename(componentPath);
    const cmdPath = displayFile || basename;
    const mithrilCount = mithrilWarnings.size;
    const a11yCount = a11yResult.violations.length;
    const totalViolations = mithrilCount + a11yCount;
    const hasViolations = totalViolations > 0;

    // Mithril violations with a nearest token match are auto-fixable via flint_fix
    const mithrilFixable = Array.from(mithrilWarnings.values()).filter(
        w => w.fixable || w.nearestToken
    ).length;
    const totalFixable = mithrilFixable + a11yResult.fixableCount;

    const lines: string[] = [];

    // ── Header ─────────────────────────────────────────────────────────────
    lines.push(`# Flint Governance Report`);
    lines.push("");
    lines.push(`**File:** \`${basename}\``);
    lines.push("");

    // ── Verdict + Narrative ────────────────────────────────────────────────
    if (hasViolations) {
        lines.push(`## BLOCKED — Export Gate Locked`);
        lines.push("");

        const parts: string[] = [];
        if (mithrilCount > 0) parts.push(`${mithrilCount} design token violation${mithrilCount !== 1 ? "s" : ""}`);
        if (a11yCount > 0) parts.push(`${a11yCount} accessibility failure${a11yCount !== 1 ? "s" : ""}`);
        const fixNote = totalFixable > 0
            ? ` ${totalFixable} auto-fixable via \`flint_fix\`.`
            : " Manual remediation required.";
        lines.push(`> ${parts.join(" and ")} prevent export.${fixNote}`);
    } else {
        lines.push(`## APPROVED — Export Gate Open`);
        lines.push("");
        lines.push(`> All ${a11yResult.totalRules} accessibility rules and design system checks passing. Component is export-ready.`);
    }
    lines.push("");

    // ── Dashboard ──────────────────────────────────────────────────────────
    lines.push(`| Metric | Result |`);
    lines.push(`|--------|--------|`);

    if (mithrilCount > 0) {
        lines.push(`| Design Tokens | ${mithrilCount} hardcoded value${mithrilCount !== 1 ? "s" : ""} — not in token set |`);
    } else {
        lines.push(`| Design Tokens | Passing |`);
    }

    lines.push(`| WCAG 2.1 AA | ${a11yResult.compliancePercent}% compliant — ${a11yResult.passed}/${a11yResult.totalRules} rules passing |`);

    if (hasViolations) {
        lines.push(`| Auto-fixable | ${totalFixable} of ${totalViolations} |`);
    }
    lines.push(`| Tokens Loaded | ${tokens.length} |`);
    lines.push("");

    // ── Design System Violations ───────────────────────────────────────────
    if (mithrilCount > 0) {
        lines.push(`---`);
        lines.push("");

        const sevCounts = countSeverities(Array.from(mithrilWarnings.values()).map(w => w.severity ?? "amber"));
        lines.push(`### Design System Violations (${sevCounts})`);
        lines.push("");
        lines.push(`| Element | Rule | Issue | Fix |`);
        lines.push(`|---------|------|-------|-----|`);

        const mithrilExplanations: string[] = [];
        let mIdx = 1;
        for (const [nodeId, w] of mithrilWarnings) {
            const rule = w.ruleId ?? typeToRuleId(w.type);
            const { issue } = splitMessage(stripRulePrefix(w.message));
            const isCritical = w.severity === "critical";

            let fix: string;
            if (w.nearestToken) {
                fix = `Use \`${w.nearestToken}\`${w.nearestTokenValue ? ` (${w.nearestTokenValue})` : ""}`;
            } else {
                const { fix: msgFix } = splitMessage(stripRulePrefix(w.message));
                fix = msgFix ? capitalize(msgFix) : firstSentence(w.recovery ?? "Add to token set");
            }

            const issueText = isCritical ? `**${capitalize(issue)}**` : capitalize(issue);
            lines.push(`| \`${nodeId}\` | ${rule} | ${issueText} | ${fix} |`);

            if (w.explanation) {
                mithrilExplanations.push(`${mIdx}. **${rule}** — ${firstSentence(w.explanation)}`);
            }
            mIdx++;
        }
        lines.push("");

        // Why it matters — educational context from error taxonomy
        if (mithrilExplanations.length > 0) {
            lines.push(`**Why it matters:**`);
            for (const exp of mithrilExplanations) {
                lines.push(exp);
            }
            lines.push("");
        }
    }

    // ── Accessibility Violations ───────────────────────────────────────────
    if (a11yCount > 0) {
        lines.push(`---`);
        lines.push("");

        const sevCounts = countSeverities(a11yResult.violations.map(v => v.severity));
        lines.push(`### Accessibility Violations (${sevCounts})`);
        lines.push("");
        lines.push(`| Element | Issue | WCAG | Fix |`);
        lines.push(`|---------|-------|------|-----|`);

        const a11yExplanations: string[] = [];
        let aIdx = 1;
        for (const v of a11yResult.violations) {
            const cleanMsg = stripRulePrefix(v.message);
            const issue = firstSentence(cleanMsg);
            const isCritical = v.severity === "critical";
            const wcag = v.wcag || "—";

            const fix = v.recovery
                ? firstSentence(v.recovery)
                : extractSecondSentence(cleanMsg);

            const issueText = isCritical ? `**${issue}**` : issue;
            lines.push(`| \`${v.elementId}\` | ${issueText} | ${wcag} | ${fix} |`);

            if (v.explanation) {
                a11yExplanations.push(`${aIdx}. **${v.ruleId}** — ${firstSentence(v.explanation)}`);
            }
            aIdx++;
        }
        lines.push("");

        // Why it matters — educational context from error taxonomy
        if (a11yExplanations.length > 0) {
            lines.push(`**Why it matters:**`);
            for (const exp of a11yExplanations) {
                lines.push(exp);
            }
            lines.push("");
        }
    }

    // ── What's Next ─────────────────────────────────────────────────────────
    if (hasViolations) {
        lines.push(`---`);
        lines.push("");
        lines.push(`### What's Next`);
        lines.push("");

        if (totalFixable > 0) {
            lines.push(`- Say **"fix it"** to auto-remediate ${totalFixable} violation${totalFixable !== 1 ? "s" : ""}`);
            lines.push(`- Say **"preview fixes"** to see what would change first`);
        }

        const manualCount = totalViolations - totalFixable;
        if (manualCount > 0) {
            if (mithrilCount - mithrilFixable > 0) {
                lines.push(`- **${mithrilCount - mithrilFixable} token violation${(mithrilCount - mithrilFixable) !== 1 ? "s" : ""}** need new tokens added to \`design-tokens.json\``);
            }
            if (a11yCount - a11yResult.fixableCount > 0) {
                lines.push(`- **${a11yCount - a11yResult.fixableCount} accessibility violation${(a11yCount - a11yResult.fixableCount) !== 1 ? "s" : ""}** need manual fixes — see the Fix column above`);
            }
        }

        lines.push(`- Say **"re-audit"** after making changes`);
    }

    return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip leading rule ID prefix from a violation message.
 * "MITHRIL-TYP-005: arbitrary '0.08em'..." → "arbitrary '0.08em'..."
 * "A11Y-010: Heading <h2> skips..." → "Heading <h2> skips..."
 */
function stripRulePrefix(message: string): string {
    return message.replace(/^[A-Z0-9]+-[A-Z0-9-]+:\s*/, "");
}

/**
 * Split a message on " — " into issue and fix parts.
 * Wraps single-quoted values in backticks for markdown.
 */
function splitMessage(message: string): { issue: string; fix: string | null } {
    const idx = message.indexOf(" — ");
    if (idx === -1) {
        return { issue: message.replace(/'([^']+)'/g, "`$1`"), fix: null };
    }
    const issue = message.slice(0, idx).replace(/'([^']+)'/g, "`$1`");
    const fix = message.slice(idx + 3);
    return { issue, fix };
}

/** Extract the first sentence (up to first period followed by space or end). */
function firstSentence(text: string): string {
    const match = text.match(/^(.+?)\.\s/);
    if (match) return match[1].trim();
    // No sentence break found — return the whole thing, trimmed
    return text.replace(/\.$/, "").trim();
}

/** Extract the second sentence onward as fix guidance. */
function extractSecondSentence(text: string): string {
    const match = text.match(/^.+?\.\s+(.+)/);
    if (match) return firstSentence(match[1]);
    return "See guidance above";
}

function capitalize(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Count severities and return a compact label like "2 critical, 1 warning". */
function countSeverities(severities: string[]): string {
    const counts: Record<string, number> = {};
    for (const s of severities) {
        const key = s.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
    }
    // Order: critical first, then amber, warning, advisory, info
    const order = ["critical", "amber", "warning", "advisory", "info"];
    const parts: string[] = [];
    for (const sev of order) {
        if (counts[sev]) {
            parts.push(`${counts[sev]} ${sev}`);
        }
    }
    // Catch any severities not in the order list
    for (const [sev, count] of Object.entries(counts)) {
        if (!order.includes(sev)) {
            parts.push(`${count} ${sev}`);
        }
    }
    return parts.join(", ");
}

function typeToRuleId(type: string): string {
    switch (type) {
        case "color-drift": return "MITHRIL-COL";
        case "typography-drift": return "MITHRIL-TYP";
        case "spacing-drift": return "MITHRIL-SPC";
        case "shadow-drift": return "MITHRIL-SHD";
        case "opacity-drift": return "MITHRIL-OPC";
        default: return "MITHRIL";
    }
}

// ---------------------------------------------------------------------------
// formatMutationReceipt
// ---------------------------------------------------------------------------

export function formatMutationReceipt(
    targetPath: string,
    mutations: Array<{ type: string; args: Record<string, unknown> }>,
    batchId: string,
    written: boolean
): string {
    const basename = path.basename(targetPath);
    const status = written ? "Written to disk" : "Dry run (no changes written)";

    const lines: string[] = [
        "## Mutation Receipt",
        "",
        `File: ${basename}`,
        `Batch: ${batchId}`,
        `Status: ${status}`,
        "",
        `### Operations (${mutations.length})`,
    ];

    mutations.forEach((mutation, index) => {
        const argParts = Object.entries(mutation.args)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(", ");
        const argStr = argParts ? ` — ${argParts}` : "";
        lines.push(`${index + 1}. ${mutation.type}${argStr}`);
    });

    return lines.join("\n");
}