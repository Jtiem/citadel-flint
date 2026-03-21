/**
 * A11y Rule Runner — flint-mcp/src/core/a11y/runner.ts
 *
 * Loads all registered A11y rules, executes them in a single Babel AST
 * traversal pass, and aggregates the results into an A11yAuditResult.
 *
 * Architecture: single traversal — all rules with `visitElement` attach to
 * the same JSXElement visitor. Document-level rules run once post-traversal.
 */

import _traverse from '@babel/traverse'
import type { File as BabelFile } from '@babel/types'
import type {
    A11yRule,
    A11yRuleContext,
    A11yRuleCategory,
    A11yViolationDetail,
    A11yAuditResult,
    A11yCriterionResult,
    WCAGCriterion,
} from './types.js'
import type { DesignToken } from '../../types.js'
import { getFlintId, getTagName, getAttributeStringValue, getExplicitRole, getImplicitRole } from './helpers.js'
import { extractColorContext } from './contrast-utils.js'
import { getErrorEntryByRuleId } from '../errorTaxonomy.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── WCAG criterion name lookup ────────────────────────────────────────────────

const CRITERION_NAMES: Record<string, { name: string; level: 'A' | 'AA' | 'AAA' }> = {
    '1.1.1': { name: 'Non-text Content', level: 'A' },
    '1.3.1': { name: 'Info and Relationships', level: 'A' },
    '1.3.5': { name: 'Identify Input Purpose', level: 'AA' },
    '1.4.3': { name: 'Contrast (Minimum)', level: 'AA' },
    '1.4.6': { name: 'Contrast (Enhanced)', level: 'AAA' },
    '1.4.11': { name: 'Non-text Contrast', level: 'AA' },
    '2.1.1': { name: 'Keyboard', level: 'A' },
    '2.1.2': { name: 'No Keyboard Trap', level: 'A' },
    '2.4.1': { name: 'Bypass Blocks', level: 'A' },
    '2.4.2': { name: 'Page Titled', level: 'A' },
    '2.4.3': { name: 'Focus Order', level: 'A' },
    '2.4.4': { name: 'Link Purpose (In Context)', level: 'A' },
    '2.4.6': { name: 'Headings and Labels', level: 'AA' },
    '2.4.7': { name: 'Focus Visible', level: 'AA' },
    '2.4.10': { name: 'Section Headings', level: 'AAA' },
    '3.1.1': { name: 'Language of Page', level: 'A' },
    '3.3.1': { name: 'Error Identification', level: 'A' },
    '3.3.2': { name: 'Labels or Instructions', level: 'A' },
    '3.3.3': { name: 'Error Suggestion', level: 'AA' },
    '3.3.4': { name: 'Error Prevention (Legal, Financial, Data)', level: 'AA' },
    '4.1.2': { name: 'Name, Role, Value', level: 'A' },
    '4.1.3': { name: 'Status Messages', level: 'AA' },
}

// ── Runner options ────────────────────────────────────────────────────────────

export interface RunnerOptions {
    /** File path being audited. */
    filePath: string
    /** Design tokens for contrast checking. */
    tokens?: DesignToken[]
    /** If set, only run rules for these WCAG criteria. */
    criteria?: WCAGCriterion[]
    /** If set, only run rules in these categories. */
    categories?: A11yRuleCategory[]
    /** Per-rule policy modes from POL.1. 'off' skips the rule, 'advisory' downgrades severity. */
    ruleModes?: Record<string, 'blocking' | 'advisory' | 'off'>
    /** Conformance level filter — only run rules at or below this level. */
    conformanceLevel?: 'A' | 'AA' | 'AAA'
}

// ── Rule registry ─────────────────────────────────────────────────────────────

/** All registered rules. Populated by registerRules(). */
const registeredRules: A11yRule[] = []

/** True after rules have been loaded. */
let rulesLoaded = false

/**
 * Registers an array of rules into the runner.
 * Idempotent — duplicate IDs are skipped.
 */
export function registerRules(rules: A11yRule[]): void {
    const existingIds = new Set(registeredRules.map((r) => r.id))
    for (const rule of rules) {
        if (!existingIds.has(rule.id)) {
            registeredRules.push(rule)
            existingIds.add(rule.id)
        }
    }
}

/**
 * Loads all rule modules and registers them.
 * Called lazily on first audit() call.
 */
async function ensureRulesLoaded(): Promise<void> {
    if (rulesLoaded) return
    rulesLoaded = true

    const [
        { namesLabelsRules },
        { keyboardRules },
        { structureRules },
        { ariaRules },
        { landmarksRules },
        { contrastRules },
        { formsRules },
    ] = await Promise.all([
        import('./rules/names-labels.js'),
        import('./rules/keyboard.js'),
        import('./rules/structure.js'),
        import('./rules/aria.js'),
        import('./rules/landmarks.js'),
        import('./rules/contrast.js'),
        import('./rules/forms.js'),
    ])

    registerRules([
        ...namesLabelsRules,
        ...keyboardRules,
        ...structureRules,
        ...ariaRules,
        ...landmarksRules,
        ...contrastRules,
        ...formsRules,
    ])
}

/**
 * Resets the rule registry (for testing).
 */
export function resetRules(): void {
    registeredRules.length = 0
    rulesLoaded = false
}

// ── Context factory ───────────────────────────────────────────────────────────

function createContext(options: RunnerOptions): A11yRuleContext {
    return {
        filePath: options.filePath,
        headingLevels: [],
        landmarksFound: new Set(),
        elementRoles: new Map(),
        idToElementMap: new Map(),
        labelTargetIds: new Set(),
        tokens: options.tokens ?? [],
        colorContext: new Map(),
        landmarkInstances: [],
        h1Count: 0,
        totalElements: 0,
        hasPageStructure: false,
    }
}

// ── Core audit function ───────────────────────────────────────────────────────

/**
 * Runs all registered rules against the given AST and returns an A11yAuditResult.
 *
 * This is the synchronous audit path. If rules have not been registered yet,
 * call `await audit()` instead (which uses `auditAsync`).
 */
export function auditSync(ast: BabelFile, options: RunnerOptions): A11yAuditResult {
    const context = createContext(options)
    const allViolations: A11yViolationDetail[] = []

    // Filter rules by criteria / categories / policy modes / conformance level
    const ruleModes = options.ruleModes ?? {}
    const activeRules = registeredRules.filter((rule) => {
        // POL.1: Skip rules explicitly set to 'off' in policy
        if (ruleModes[rule.id] === 'off') return false
        if (options.criteria && options.criteria.length > 0) {
            if (!options.criteria.includes(rule.wcag)) return false
        }
        if (options.categories && options.categories.length > 0) {
            if (!options.categories.includes(rule.category)) return false
        }
        if (options.conformanceLevel) {
            if (options.conformanceLevel === 'A' && rule.level !== 'A') return false
            if (options.conformanceLevel === 'AA' && rule.level === 'AAA') return false
        }
        return true
    })
    // POL.1: Track which rules are in advisory mode for severity downgrade
    const advisoryRuleIds = new Set(
        Object.entries(ruleModes)
            .filter(([, mode]) => mode === 'advisory')
            .map(([id]) => id)
    )

    // Element-level rules
    const elementVisitorRules = activeRules.filter((r) => r.visitElement != null)
    // Document-level rules
    const documentRules = activeRules.filter((r) => r.auditDocument != null)

    let elementIndex = 0

    traverse(ast, {
        JSXElement(path) {
            const opening = path.node.openingElement
            const tag = getTagName(path)
            if (!tag) return

            elementIndex++
            context.totalElements++

            // Detect page-structure indicators
            const PAGE_STRUCTURE_TAGS = new Set(['html', 'body', 'header', 'footer', 'section', 'article', 'aside', 'main', 'nav'])
            if (PAGE_STRUCTURE_TAGS.has(tag) || /^h[1-6]$/.test(tag)) {
                context.hasPageStructure = true
            }

            const flintId = getFlintId(opening, `${tag}-${elementIndex}`)

            // Update context: heading levels
            const headingMatch = /^h([1-6])$/.exec(tag)
            if (headingMatch) {
                const level = parseInt(headingMatch[1], 10)
                context.headingLevels.push(level)
                if (level === 1) context.h1Count++
            }

            // Update context: landmarks
            const explicitRole = getExplicitRole(opening)
            const implicitRole = getImplicitRole(tag)
            const effectiveRole = explicitRole ?? implicitRole

            if (effectiveRole) {
                context.elementRoles.set(flintId, effectiveRole)

                const landmarkRoles = new Set(['main', 'navigation', 'banner', 'contentinfo', 'complementary', 'search', 'form', 'region'])
                if (landmarkRoles.has(effectiveRole)) {
                    context.landmarksFound.add(effectiveRole)
                    const labelAttr = getAttributeStringValue(opening, 'aria-label') ??
                        getAttributeStringValue(opening, 'aria-labelledby')
                    context.landmarkInstances.push({
                        role: effectiveRole,
                        label: labelAttr,
                        elementId: flintId,
                    })
                }
            }

            // Update context: id mapping
            const idVal = getAttributeStringValue(opening, 'id')
            if (idVal) {
                context.idToElementMap.set(idVal, flintId)
            }

            // Update context: color context from className
            const classNameAttr = getAttributeStringValue(opening, 'className')
            if (classNameAttr) {
                const classes = classNameAttr.split(/\s+/).filter(Boolean)
                const colors = extractColorContext(classes)
                context.colorContext.set(flintId, colors)
            }

            // Run element-level rules
            for (const rule of elementVisitorRules) {
                try {
                    const violation = rule.visitElement!(path, context)
                    if (violation) {
                        const taxEntry = getErrorEntryByRuleId(violation.ruleId)
                        const base = taxEntry !== null
                            ? { ...violation, explanation: taxEntry.explanation, recovery: taxEntry.recovery }
                            : violation
                        allViolations.push(
                            advisoryRuleIds.has(base.ruleId)
                                ? { ...base, severity: 'advisory' as const }
                                : base,
                        )
                    }
                } catch {
                    // Swallow per-rule errors — governance engine must not crash
                }
            }
        },
    })

    // Run document-level rules
    for (const rule of documentRules) {
        try {
            const violations = rule.auditDocument!(context)
            for (const violation of violations) {
                const taxEntry = getErrorEntryByRuleId(violation.ruleId)
                const base = taxEntry !== null
                    ? { ...violation, explanation: taxEntry.explanation, recovery: taxEntry.recovery }
                    : violation
                allViolations.push(
                    advisoryRuleIds.has(base.ruleId)
                        ? { ...base, severity: 'advisory' as const }
                        : base,
                )
            }
        } catch {
            // Swallow per-rule errors
        }
    }

    return buildResult(options.filePath, activeRules, allViolations)
}

/**
 * Asynchronous audit — loads rules lazily, then delegates to auditSync.
 */
export async function audit(ast: BabelFile, options: RunnerOptions): Promise<A11yAuditResult> {
    await ensureRulesLoaded()
    return auditSync(ast, options)
}

// ── Result builder ────────────────────────────────────────────────────────────

function buildResult(
    filePath: string,
    activeRules: A11yRule[],
    violations: A11yViolationDetail[],
): A11yAuditResult {
    const totalRules = activeRules.length

    // Which rule IDs had at least one violation?
    const failedRuleIds = new Set(violations.map((v) => v.ruleId))
    const passed = totalRules - failedRuleIds.size
    const failed = failedRuleIds.size
    const compliancePercent =
        totalRules === 0 ? 100 : Math.round((passed / totalRules) * 100 * 10) / 10

    const fixableCount = violations.filter((v) => v.fixable).length

    // Build per-criterion results
    const criterionMap = new Map<WCAGCriterion, {
        violations: A11yViolationDetail[]
        failedRules: Set<string>
    }>()

    for (const rule of activeRules) {
        if (!criterionMap.has(rule.wcag)) {
            criterionMap.set(rule.wcag, { violations: [], failedRules: new Set() })
        }
    }

    for (const v of violations) {
        const rule = activeRules.find((r) => r.id === v.ruleId)
        if (!rule) continue
        const entry = criterionMap.get(rule.wcag)
        if (!entry) continue
        entry.violations.push(v)
        entry.failedRules.add(v.ruleId)
    }

    const criterionResults: A11yCriterionResult[] = []
    for (const [criterion, data] of criterionMap.entries()) {
        const meta = CRITERION_NAMES[criterion]
        criterionResults.push({
            criterion,
            name: meta?.name ?? criterion,
            level: meta?.level ?? 'A',
            passed: data.failedRules.size === 0,
            failedRules: Array.from(data.failedRules),
            violationCount: data.violations.length,
        })
    }

    criterionResults.sort((a, b) => a.criterion.localeCompare(b.criterion))

    return {
        filePath,
        totalRules,
        passed,
        failed,
        compliancePercent,
        violations,
        criterionResults,
        fixableCount,
        timestamp: new Date().toISOString(),
    }
}

// ── Convenience: get all registered rules ─────────────────────────────────────

export function getRegisteredRules(): A11yRule[] {
    return [...registeredRules]
}
