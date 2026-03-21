/**
 * DBOM Formatter — flint-mcp/src/core/dbom/formatter.ts
 *
 * Renders a DesignBillOfMaterials as a human-readable Markdown document
 * suitable for CI reports, PR comments, and CLI output.
 */

import type { DesignBillOfMaterials } from './types.js'

/**
 * Formats a DBOM as a Markdown document.
 */
export function formatDBOMAsMarkdown(dbom: DesignBillOfMaterials): string {
    const lines: string[] = []

    const gradeEmoji: Record<string, string> = { A: 'A', B: 'B', C: 'C', D: 'D', F: 'F' }
    const statusEmoji: Record<string, string> = {
        compliant: 'COMPLIANT',
        'non-compliant': 'NON-COMPLIANT',
        partial: 'PARTIAL',
    }

    lines.push(`# Design Bill of Materials`)
    lines.push('')
    lines.push(`**Generated:** ${dbom.generatedAt}`)
    lines.push(`**Project:** ${dbom.projectRoot}`)
    lines.push(`**Schema Version:** ${dbom.version}`)
    lines.push('')

    // ── Summary ────────────────────────────────────────────────────────────────
    lines.push(`## Summary`)
    lines.push('')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Health Score | ${dbom.summary.healthScore}/100 |`)
    lines.push(`| Grade | ${gradeEmoji[dbom.summary.grade] ?? dbom.summary.grade} |`)
    lines.push(`| Compliance Status | ${statusEmoji[dbom.summary.complianceStatus] ?? dbom.summary.complianceStatus} |`)
    lines.push(`| Files Scanned | ${dbom.summary.totalFiles} |`)
    lines.push(`| Components | ${dbom.summary.totalComponents} |`)
    lines.push(`| Design Tokens | ${dbom.summary.totalTokens} |`)
    if (dbom.overrides.length > 0) {
        lines.push(`| Active Overrides | ${dbom.overrides.length} (export blocked) |`)
    }
    lines.push('')

    // ── Policy ─────────────────────────────────────────────────────────────────
    lines.push(`## Governance Policy`)
    lines.push('')
    lines.push(`| Setting | Value |`)
    lines.push(`|---------|-------|`)
    lines.push(`| ΔE Threshold | ${dbom.policy.deltaE_threshold} |`)
    lines.push(`| A11y Level | WCAG ${dbom.policy.a11y_level} |`)
    lines.push(`| Mithril Mode | ${dbom.policy.mode} |`)
    lines.push('')

    // ── Baseline delta ─────────────────────────────────────────────────────────
    if (dbom.baseline) {
        lines.push(`## Baseline Comparison`)
        lines.push('')
        lines.push(`| | Value |`)
        lines.push(`|-|-------|`)
        lines.push(`| Baseline Set | ${dbom.baseline.setAt} |`)
        lines.push(`| Violations at Baseline | ${dbom.baseline.violationsAtBaseline} |`)
        const delta = dbom.baseline.newViolationsSinceBaseline
        const sign = delta > 0 ? '+' : ''
        lines.push(`| New Violations Since Baseline | ${sign}${delta} |`)
        lines.push('')
    }

    // ── Components with violations ─────────────────────────────────────────────
    const criticalComponents = dbom.components.filter((c) => c.status === 'critical')
    const warningComponents = dbom.components.filter((c) => c.status === 'warning')
    const cleanComponents = dbom.components.filter((c) => c.status === 'clean')

    lines.push(`## Components`)
    lines.push('')
    lines.push(`| Status | Count |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Clean | ${cleanComponents.length} |`)
    lines.push(`| Warning (Amber) | ${warningComponents.length} |`)
    lines.push(`| Critical | ${criticalComponents.length} |`)
    lines.push('')

    if (criticalComponents.length > 0) {
        lines.push(`### Critical Components`)
        lines.push('')
        for (const comp of criticalComponents.slice(0, 20)) {
            const totalViolations = comp.violations.length + comp.a11yViolations.length
            lines.push(`#### ${comp.name}`)
            lines.push('')
            lines.push(`- **File:** \`${comp.filePath}\``)
            lines.push(`- **Token Coverage:** ${comp.tokenCoverage}%`)
            lines.push(`- **Violations:** ${totalViolations}`)
            if (comp.a11yViolations.length > 0) {
                lines.push(`- **A11y violations:**`)
                for (const v of comp.a11yViolations) {
                    lines.push(`  - \`${v.ruleId}\`: ${v.message}`)
                }
            }
            if (comp.violations.length > 0) {
                lines.push(`- **Mithril violations:**`)
                for (const v of comp.violations.slice(0, 5)) {
                    lines.push(`  - \`${v.ruleId}\` (${v.severity}): ${v.message}`)
                }
                if (comp.violations.length > 5) {
                    lines.push(`  - …and ${comp.violations.length - 5} more`)
                }
            }
            lines.push('')
        }
        if (criticalComponents.length > 20) {
            lines.push(`> ${criticalComponents.length - 20} additional critical components omitted — see full JSON for details.`)
            lines.push('')
        }
    }

    if (warningComponents.length > 0) {
        lines.push(`### Warning Components (Amber)`)
        lines.push('')
        lines.push(`| Component | File | Token Coverage | Violations |`)
        lines.push(`|-----------|------|----------------|------------|`)
        for (const comp of warningComponents.slice(0, 15)) {
            lines.push(`| ${comp.name} | \`${comp.filePath}\` | ${comp.tokenCoverage}% | ${comp.violations.length} |`)
        }
        if (warningComponents.length > 15) {
            lines.push(`| … | (${warningComponents.length - 15} more) | | |`)
        }
        lines.push('')
    }

    // ── Token inventory ────────────────────────────────────────────────────────
    lines.push(`## Design Token Inventory`)
    lines.push('')
    lines.push(`| Token | Type | Value | Usage |`)
    lines.push(`|-------|------|-------|-------|`)

    // Sort tokens: used tokens first (by usage count desc), then unused
    const sortedTokens = [...dbom.tokens].sort((a, b) => b.usageCount - a.usageCount)
    const topTokens = sortedTokens.slice(0, 30)
    for (const tok of topTokens) {
        const usageLabel = tok.usageCount === 0 ? 'UNUSED' : `${tok.usageCount} file(s)`
        const truncatedValue = tok.value.length > 30 ? tok.value.slice(0, 27) + '...' : tok.value
        lines.push(`| \`${tok.path}\` | ${tok.type} | \`${truncatedValue}\` | ${usageLabel} |`)
    }
    if (sortedTokens.length > 30) {
        lines.push(`| … | (${sortedTokens.length - 30} more tokens) | | |`)
    }
    lines.push('')

    // ── Dead tokens ────────────────────────────────────────────────────────────
    const deadTokens = dbom.tokens.filter((t) => t.usageCount === 0)
    if (deadTokens.length > 0) {
        lines.push(`## Unused Tokens (Dead Tokens)`)
        lines.push('')
        lines.push(`These ${deadTokens.length} token(s) are not referenced in any scanned source file:`)
        lines.push('')
        for (const tok of deadTokens.slice(0, 20)) {
            lines.push(`- \`${tok.path}\` (${tok.type}: ${tok.value})`)
        }
        if (deadTokens.length > 20) {
            lines.push(`- …and ${deadTokens.length - 20} more`)
        }
        lines.push('')
    }

    // ── Active overrides ───────────────────────────────────────────────────────
    if (dbom.overrides.length > 0) {
        lines.push(`## Active Property Overrides`)
        lines.push('')
        lines.push(`These ${dbom.overrides.length} override(s) block export until resolved:`)
        lines.push('')
        lines.push(`| Node ID | Property | Value |`)
        lines.push(`|---------|----------|-------|`)
        for (const ov of dbom.overrides.slice(0, 20)) {
            const truncVal = ov.value.length > 40 ? ov.value.slice(0, 37) + '...' : ov.value
            lines.push(`| \`${ov.nodeId}\` | ${ov.property} | \`${truncVal}\` |`)
        }
        if (dbom.overrides.length > 20) {
            lines.push(`| … | (${dbom.overrides.length - 20} more) | |`)
        }
        lines.push('')
    }

    return lines.join('\n')
}
