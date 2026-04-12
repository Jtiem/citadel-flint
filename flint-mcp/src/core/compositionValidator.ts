/**
 * Composition Validator — flint-mcp/src/core/compositionValidator.ts
 *
 * P2.5: Composition & Slot Governance. Validates parent-child component
 * relationships against declarative composition rules from the registry.
 *
 * Traverses JSX AST depth-first maintaining a parent stack. At each
 * component node, resolves against the registry and checks compositionRules:
 *
 *   - MITHRIL-COMP-001: Forbidden child (e.g., Card inside Button)
 *   - MITHRIL-COMP-002: Missing required parent (e.g., DialogFooter outside Dialog)
 *   - MITHRIL-COMP-003: Max nesting depth exceeded (e.g., Card > Card > Card)
 *
 * All composition violations are classified as **semantic** in the Mutation
 * Planner — Flint identifies what is wrong but cannot fix composition
 * automatically because the correct restructuring depends on developer intent.
 *
 * Phase: P2.5 (Composition & Slot Governance)
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File } from '@babel/types'
import type { LinterWarning } from '../types.js'
import type { ComponentEntry } from './registryService.js'
import type { PolicyOptions } from './MithrilLinter.js'
import { getErrorEntryByRuleId } from './errorTaxonomy.js'

// CJS/ESM interop
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompositionRules {
    allowedChildren?: string[]
    forbiddenChildren?: string[]
    requiredParent?: string
    maxDepth?: number
}

// ── Default composition rules for common design system patterns ──────────────

export const DEFAULT_COMPOSITION_RULES: Record<string, CompositionRules> = {
    Button: {
        forbiddenChildren: ['Card', 'Table', 'Dialog', 'Tabs'],
    },
    DialogFooter: {
        requiredParent: 'Dialog',
    },
    TabPanel: {
        requiredParent: 'Tabs',
    },
    Card: {
        maxDepth: 2,
    },
}

// ── Core Validator ──────────────────────────────────────────────────────────

/**
 * Validates composition rules across a JSX AST tree.
 *
 * @param ast        Babel AST (parsed TSX/JSX file)
 * @param registry   Component registry entries (keyed by name)
 * @param options    Policy options for per-rule mode overrides
 * @returns          Map of warning ID to LinterWarning for composition violations
 */
export function validateComposition(
    ast: File,
    registry: Record<string, ComponentEntry>,
    options?: PolicyOptions,
): Map<string, LinterWarning> {
    const warnings = new Map<string, LinterWarning>()

    // No registry → skip entirely
    if (!registry || Object.keys(registry).length === 0) return warnings

    // Build a merged rules map: registry compositionRules + defaults
    const rulesMap = buildRulesMap(registry)
    if (rulesMap.size === 0) return warnings

    // Pre-fetch taxonomy entries for each rule ID
    const taxonomy001 = getErrorEntryByRuleId('MITHRIL-COMP-001')
    const taxonomy002 = getErrorEntryByRuleId('MITHRIL-COMP-002')
    const taxonomy003 = getErrorEntryByRuleId('MITHRIL-COMP-003')

    // Track parent stack during traversal
    const parentStack: string[] = []
    // Track nesting depth per component name
    const depthStack: Map<string, number> = new Map()

    traverse(ast, {
        JSXElement: {
            enter(path) {
                const openingEl = path.node.openingElement
                const nameNode = openingEl.name
                if (!t.isJSXIdentifier(nameNode)) return

                const componentName = nameNode.name
                // Only check PascalCase components (design system components)
                if (!isPascalCase(componentName)) return

                const loc = nameNode.loc?.start
                const rules = rulesMap.get(componentName)

                // ── MITHRIL-COMP-002: Required parent check ─────────────
                if (rules?.requiredParent) {
                    const mode002 = options?.ruleModes?.['MITHRIL-COMP-002']
                    if (mode002 !== 'off') {
                        const hasRequiredParent = parentStack.includes(rules.requiredParent)
                        if (!hasRequiredParent) {
                            const warningId = `comp-002-${componentName}-${loc?.line ?? 0}-${loc?.column ?? 0}`
                            const severity: LinterWarning['severity'] = mode002 === 'advisory' ? 'advisory' : 'amber'
                            warnings.set(warningId, {
                                id: warningId,
                                type: 'composition',
                                severity,
                                value: 0,
                                message: `<${componentName}> requires a <${rules.requiredParent}> parent but none was found in the ancestor chain.`,
                                nearestToken: null,
                                nearestTokenValue: null,
                                ruleId: 'MITHRIL-COMP-002',
                                fixable: false,
                                explanation: taxonomy002?.explanation ??
                                    'A component with a required parent constraint was used outside its expected container.',
                                recovery: taxonomy002?.recovery ??
                                    `Wrap <${componentName}> inside a <${rules.requiredParent}> component.`,
                                line: loc?.line,
                                column: loc?.column,
                            })
                        }
                    }
                }

                // ── MITHRIL-COMP-003: Max depth check ───────────────────
                if (rules?.maxDepth !== undefined) {
                    const mode003 = options?.ruleModes?.['MITHRIL-COMP-003']
                    if (mode003 !== 'off') {
                        const currentDepth = (depthStack.get(componentName) ?? 0) + 1
                        if (currentDepth > rules.maxDepth) {
                            const warningId = `comp-003-${componentName}-${loc?.line ?? 0}-${loc?.column ?? 0}`
                            const severity: LinterWarning['severity'] = mode003 === 'advisory' ? 'advisory' : 'amber'
                            warnings.set(warningId, {
                                id: warningId,
                                type: 'composition',
                                severity,
                                value: 0,
                                message: `<${componentName}> nesting depth ${currentDepth} exceeds maximum allowed depth of ${rules.maxDepth}.`,
                                nearestToken: null,
                                nearestTokenValue: null,
                                ruleId: 'MITHRIL-COMP-003',
                                fixable: false,
                                explanation: taxonomy003?.explanation ??
                                    'A component is nested deeper than its maximum allowed depth.',
                                recovery: taxonomy003?.recovery ??
                                    `Reduce <${componentName}> nesting to at most ${rules.maxDepth} levels.`,
                                line: loc?.line,
                                column: loc?.column,
                            })
                        }
                        depthStack.set(componentName, currentDepth)
                    }
                }

                // ── MITHRIL-COMP-001: Forbidden child check ─────────────
                // Check if any ancestor forbids this component as a child
                {
                    const mode001 = options?.ruleModes?.['MITHRIL-COMP-001']
                    if (mode001 !== 'off') {
                        for (const ancestor of parentStack) {
                            const ancestorRules = rulesMap.get(ancestor)
                            if (!ancestorRules) continue

                            // Forbidden children check
                            if (ancestorRules.forbiddenChildren?.includes(componentName)) {
                                const warningId = `comp-001-${componentName}-in-${ancestor}-${loc?.line ?? 0}-${loc?.column ?? 0}`
                                const severity: LinterWarning['severity'] = mode001 === 'advisory' ? 'advisory' : 'amber'
                                warnings.set(warningId, {
                                    id: warningId,
                                    type: 'composition',
                                    severity,
                                    value: 0,
                                    message: `<${componentName}> is forbidden inside <${ancestor}>.`,
                                    nearestToken: null,
                                    nearestTokenValue: null,
                                    ruleId: 'MITHRIL-COMP-001',
                                    fixable: false,
                                    explanation: taxonomy001?.explanation ??
                                        'A component that is forbidden inside this parent was found nested within it.',
                                    recovery: taxonomy001?.recovery ??
                                        `Move <${componentName}> outside of <${ancestor}>.`,
                                    line: loc?.line,
                                    column: loc?.column,
                                })
                            }

                            // Allowed children check (whitelist)
                            if (ancestorRules.allowedChildren && ancestorRules.allowedChildren.length > 0) {
                                if (!ancestorRules.allowedChildren.includes(componentName)) {
                                    const warningId = `comp-001-${componentName}-not-allowed-in-${ancestor}-${loc?.line ?? 0}-${loc?.column ?? 0}`
                                    const severity: LinterWarning['severity'] = mode001 === 'advisory' ? 'advisory' : 'amber'
                                    warnings.set(warningId, {
                                        id: warningId,
                                        type: 'composition',
                                        severity,
                                        value: 0,
                                        message: `<${componentName}> is not an allowed child of <${ancestor}>. Allowed: ${ancestorRules.allowedChildren.join(', ')}.`,
                                        nearestToken: null,
                                        nearestTokenValue: null,
                                        ruleId: 'MITHRIL-COMP-001',
                                        fixable: false,
                                        explanation: taxonomy001?.explanation ??
                                            'A component that is not in the allowed children list was found nested inside this parent.',
                                        recovery: taxonomy001?.recovery ??
                                            `Use one of the allowed children (${ancestorRules.allowedChildren.join(', ')}) inside <${ancestor}>, or move <${componentName}> elsewhere.`,
                                        line: loc?.line,
                                        column: loc?.column,
                                    })
                                }
                            }
                        }
                    }
                }

                // Push onto parent stack for children traversal
                parentStack.push(componentName)
            },
            exit(path) {
                const openingEl = path.node.openingElement
                const nameNode = openingEl.name
                if (!t.isJSXIdentifier(nameNode)) return

                const componentName = nameNode.name
                if (!isPascalCase(componentName)) return

                // Pop from parent stack
                if (parentStack.length > 0 && parentStack[parentStack.length - 1] === componentName) {
                    parentStack.pop()
                }

                // Decrement depth counter
                const rules = rulesMap.get(componentName)
                if (rules?.maxDepth !== undefined) {
                    const currentDepth = depthStack.get(componentName) ?? 1
                    if (currentDepth <= 1) {
                        depthStack.delete(componentName)
                    } else {
                        depthStack.set(componentName, currentDepth - 1)
                    }
                }
            },
        },
    })

    return warnings
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a merged composition rules map from registry entries and defaults.
 * Registry-defined rules take precedence over defaults.
 */
function buildRulesMap(registry: Record<string, ComponentEntry>): Map<string, CompositionRules> {
    const map = new Map<string, CompositionRules>()

    // Seed with defaults
    for (const [name, rules] of Object.entries(DEFAULT_COMPOSITION_RULES)) {
        map.set(name, { ...rules })
    }

    // Override/merge with registry-defined rules
    for (const [name, entry] of Object.entries(registry)) {
        if (entry.compositionRules) {
            map.set(name, { ...map.get(name), ...entry.compositionRules })
        }
    }

    return map
}

/**
 * Check if a component name is PascalCase (starts with uppercase letter).
 */
function isPascalCase(name: string): boolean {
    return name.length > 0 && name[0] >= 'A' && name[0] <= 'Z'
}
