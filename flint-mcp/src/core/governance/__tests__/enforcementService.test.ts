/**
 * Unit tests for enforcementService (Gap 7 — PDP/PEP enforcement point services)
 *
 * Coverage:
 *   resolveEnforcement:
 *     - Returns defaults when no config provided (undefined)
 *     - Returns defaults when config has no enforcement section
 *     - Parses string block_on value correctly
 *     - Parses array block_on value correctly
 *     - Parses warn_on and apply_on correctly
 *     - Custom enforcement points are preserved and merged with defaults
 *     - Unknown mode strings in YAML are dropped
 *     - decision_points adds new points to the resolved set
 *
 *   getActiveModesForDecisionPoint:
 *     - Returns all non-off modes by default
 *     - Returns configured modes for known decision point
 *     - Returns default for unknown decision point
 *
 *   getEnforcementAction:
 *     - Returns 'block' for coercive at export_gate (default)
 *     - Returns 'block' for normative at export_gate (default)
 *     - Returns 'warn' for advisory at export_gate (default)
 *     - Returns 'auto_fix' for normative at auto_fix point (default)
 *     - Returns 'warn' for advisory at auto_fix point (default)
 *     - Returns 'pass' for 'off' mode regardless of point
 *     - Returns 'block' for coercive at ci_gate (default)
 *     - Returns 'warn' for normative at ci_gate (default)
 *     - Returns 'warn' for coercive at mcp_audit (default — never blocks)
 *     - Returns 'warn' for unknown enforcement point (safe default)
 *     - Custom config overrides defaults
 *
 *   Integration:
 *     - Default enforcement matches pre-UCFG behavior exactly (backward compat)
 */

import { describe, it, expect } from 'vitest'
import type { FlintProjectConfig } from '../../config.js'
import {
    resolveEnforcement,
    getActiveModesForDecisionPoint,
    getEnforcementAction,
} from '../enforcementService.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid FlintProjectConfig with no enforcement section. */
function minimalConfig(
    overrides: Partial<FlintProjectConfig> = {}
): FlintProjectConfig {
    return { project: 'test-project', ...overrides }
}

// ── resolveEnforcement ────────────────────────────────────────────────────────

describe('resolveEnforcement — no config', () => {
    it('returns defaults when config is undefined', () => {
        const result = resolveEnforcement(undefined)
        expect(result.points).toBeDefined()
        expect(result.decisionPoints).toBeDefined()
    })

    it('includes export_gate in default points', () => {
        const result = resolveEnforcement(undefined)
        expect(result.points['export_gate']).toBeDefined()
    })

    it('includes mcp_audit in default points', () => {
        const result = resolveEnforcement(undefined)
        expect(result.points['mcp_audit']).toBeDefined()
    })

    it('includes ci_gate in default points', () => {
        const result = resolveEnforcement(undefined)
        expect(result.points['ci_gate']).toBeDefined()
    })

    it('includes auto_fix in default points', () => {
        const result = resolveEnforcement(undefined)
        expect(result.points['auto_fix']).toBeDefined()
    })
})

describe('resolveEnforcement — config with no enforcement section', () => {
    it('returns same defaults as undefined config', () => {
        const withoutEnforcement = resolveEnforcement(undefined)
        const withMinimalConfig = resolveEnforcement(minimalConfig())
        expect(withMinimalConfig.points).toEqual(withoutEnforcement.points)
        expect(withMinimalConfig.decisionPoints).toEqual(withoutEnforcement.decisionPoints)
    })

    it('export_gate blocks coercive by default', () => {
        const result = resolveEnforcement(minimalConfig())
        expect(result.points['export_gate'].blockOn).toContain('coercive')
    })

    it('export_gate blocks normative by default', () => {
        const result = resolveEnforcement(minimalConfig())
        expect(result.points['export_gate'].blockOn).toContain('normative')
    })

    it('export_gate warns on advisory by default', () => {
        const result = resolveEnforcement(minimalConfig())
        expect(result.points['export_gate'].warnOn).toContain('advisory')
    })
})

describe('resolveEnforcement — string block_on value', () => {
    it('parses a single string block_on correctly', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    custom_gate: { block_on: 'coercive', warn_on: 'normative' },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['custom_gate'].blockOn).toEqual(['coercive'])
    })

    it('does not contaminate other points', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    custom_gate: { block_on: 'coercive' },
                },
            },
        })
        const result = resolveEnforcement(config)
        // export_gate should be unchanged from defaults
        expect(result.points['export_gate'].blockOn).toContain('normative')
    })
})

describe('resolveEnforcement — array block_on value', () => {
    it('parses an array block_on correctly', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    strict_gate: { block_on: ['coercive', 'normative', 'advisory'] },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['strict_gate'].blockOn).toEqual([
            'coercive',
            'normative',
            'advisory',
        ])
    })

    it('array with a single entry parses as single-element array', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    light_gate: { block_on: ['coercive'] },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['light_gate'].blockOn).toHaveLength(1)
        expect(result.points['light_gate'].blockOn[0]).toBe('coercive')
    })
})

describe('resolveEnforcement — warn_on and apply_on', () => {
    it('parses string warn_on correctly', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    advisory_gate: { warn_on: 'advisory' },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['advisory_gate'].warnOn).toEqual(['advisory'])
    })

    it('parses array warn_on correctly', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    multi_warn: { warn_on: ['normative', 'advisory'] },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['multi_warn'].warnOn).toContain('normative')
        expect(result.points['multi_warn'].warnOn).toContain('advisory')
    })

    it('parses apply_on (auto-fix) correctly', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    fix_point: { apply_on: 'normative' },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['fix_point'].autoFixOn).toEqual(['normative'])
    })

    it('parses array apply_on correctly', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    fix_point: { apply_on: ['normative', 'advisory'] },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['fix_point'].autoFixOn).toContain('normative')
        expect(result.points['fix_point'].autoFixOn).toContain('advisory')
    })
})

describe('resolveEnforcement — custom enforcement points preserved', () => {
    it('custom points coexist with default standard points', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    my_custom_gate: { block_on: 'coercive', warn_on: 'normative' },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['my_custom_gate']).toBeDefined()
        expect(result.points['export_gate']).toBeDefined()
        expect(result.points['ci_gate']).toBeDefined()
    })

    it('custom point completely replaces the default for that point name', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    // Override export_gate to only block coercive
                    export_gate: { block_on: 'coercive', warn_on: ['normative', 'advisory'] },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['export_gate'].blockOn).toEqual(['coercive'])
        expect(result.points['export_gate'].warnOn).toContain('normative')
        expect(result.points['export_gate'].warnOn).toContain('advisory')
    })
})

describe('resolveEnforcement — unknown mode strings are dropped', () => {
    it('unknown mode strings are filtered out', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    test_gate: {
                        block_on: ['coercive', 'totally-invalid-mode', 'normative'],
                    },
                },
            },
        })
        const result = resolveEnforcement(config)
        expect(result.points['test_gate'].blockOn).toEqual(['coercive', 'normative'])
    })
})

describe('resolveEnforcement — decision_points', () => {
    it('configured decision_points are present in resolved output', () => {
        const config = minimalConfig({
            enforcement: {
                decision_points: ['my_audit_point'],
            },
        })
        const result = resolveEnforcement(config)
        expect(result.decisionPoints['my_audit_point']).toBeDefined()
    })

    it('default decision points are preserved when new ones are added', () => {
        const config = minimalConfig({
            enforcement: {
                decision_points: ['extra_point'],
            },
        })
        const result = resolveEnforcement(config)
        expect(result.decisionPoints['mcp_audit']).toBeDefined()
        expect(result.decisionPoints['export_gate']).toBeDefined()
    })

    it('new decision point gets all non-off modes', () => {
        const config = minimalConfig({
            enforcement: {
                decision_points: ['new_point'],
            },
        })
        const result = resolveEnforcement(config)
        expect(result.decisionPoints['new_point']).toContain('coercive')
        expect(result.decisionPoints['new_point']).toContain('normative')
        expect(result.decisionPoints['new_point']).toContain('advisory')
        expect(result.decisionPoints['new_point']).not.toContain('off')
    })
})

// ── getActiveModesForDecisionPoint ────────────────────────────────────────────

describe('getActiveModesForDecisionPoint', () => {
    it('returns all non-off modes by default (undefined config)', () => {
        const enforcement = resolveEnforcement(undefined)
        const modes = getActiveModesForDecisionPoint(enforcement, 'mcp_audit')
        expect(modes).toContain('coercive')
        expect(modes).toContain('normative')
        expect(modes).toContain('advisory')
        expect(modes).not.toContain('off')
    })

    it('returns configured modes for known decision point', () => {
        const enforcement = resolveEnforcement(undefined)
        const modes = getActiveModesForDecisionPoint(enforcement, 'export_gate')
        expect(modes).toContain('coercive')
        expect(modes).toContain('normative')
    })

    it('returns default modes for unknown decision point', () => {
        const enforcement = resolveEnforcement(undefined)
        const modes = getActiveModesForDecisionPoint(enforcement, 'completely_unknown_point')
        expect(modes).toContain('coercive')
        expect(modes).toContain('normative')
        expect(modes).toContain('advisory')
    })

    it('returns modes for a custom decision point configured in YAML', () => {
        const config = minimalConfig({
            enforcement: { decision_points: ['review_gate'] },
        })
        const enforcement = resolveEnforcement(config)
        const modes = getActiveModesForDecisionPoint(enforcement, 'review_gate')
        expect(modes).toContain('coercive')
    })
})

// ── getEnforcementAction ──────────────────────────────────────────────────────

describe('getEnforcementAction — default export_gate', () => {
    it('returns block for coercive at export_gate', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'export_gate', 'coercive')).toBe('block')
    })

    it('returns block for normative at export_gate', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'export_gate', 'normative')).toBe('block')
    })

    it('returns warn for advisory at export_gate', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'export_gate', 'advisory')).toBe('warn')
    })
})

describe('getEnforcementAction — default auto_fix', () => {
    it('returns auto_fix for normative at auto_fix point', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'auto_fix', 'normative')).toBe('auto_fix')
    })

    it('returns warn for advisory at auto_fix point', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'auto_fix', 'advisory')).toBe('warn')
    })

    it('returns pass for coercive at auto_fix point (not auto-fixable by default)', () => {
        const enforcement = resolveEnforcement(undefined)
        // coercive is not in blockOn, warnOn, or autoFixOn for auto_fix — should pass
        expect(getEnforcementAction(enforcement, 'auto_fix', 'coercive')).toBe('pass')
    })
})

describe('getEnforcementAction — default ci_gate', () => {
    it('returns block for coercive at ci_gate', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'ci_gate', 'coercive')).toBe('block')
    })

    it('returns warn for normative at ci_gate', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'ci_gate', 'normative')).toBe('warn')
    })

    it('returns warn for advisory at ci_gate', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'ci_gate', 'advisory')).toBe('warn')
    })
})

describe('getEnforcementAction — default mcp_audit', () => {
    it('returns warn for coercive at mcp_audit (audit never blocks)', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'mcp_audit', 'coercive')).toBe('warn')
    })

    it('returns warn for normative at mcp_audit', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'mcp_audit', 'normative')).toBe('warn')
    })

    it('returns warn for advisory at mcp_audit', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'mcp_audit', 'advisory')).toBe('warn')
    })
})

describe('getEnforcementAction — off mode', () => {
    it('returns pass for off mode regardless of enforcement point', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'export_gate', 'off')).toBe('pass')
        expect(getEnforcementAction(enforcement, 'ci_gate', 'off')).toBe('pass')
        expect(getEnforcementAction(enforcement, 'mcp_audit', 'off')).toBe('pass')
        expect(getEnforcementAction(enforcement, 'auto_fix', 'off')).toBe('pass')
    })
})

describe('getEnforcementAction — unknown enforcement point', () => {
    it('returns warn for coercive at unknown enforcement point (safe default)', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'unknown_gate', 'coercive')).toBe('warn')
    })

    it('returns warn for normative at unknown enforcement point', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'unknown_gate', 'normative')).toBe('warn')
    })

    it('returns warn for advisory at unknown enforcement point', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'unknown_gate', 'advisory')).toBe('warn')
    })

    it('returns pass for off mode at unknown enforcement point', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'unknown_gate', 'off')).toBe('pass')
    })
})

describe('getEnforcementAction — custom config overrides defaults', () => {
    it('custom config can make advisory block at export_gate', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    export_gate: {
                        block_on: ['coercive', 'normative', 'advisory'],
                    },
                },
            },
        })
        const enforcement = resolveEnforcement(config)
        expect(getEnforcementAction(enforcement, 'export_gate', 'advisory')).toBe('block')
    })

    it('custom config can reduce export_gate to only block coercive', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    export_gate: {
                        block_on: 'coercive',
                        warn_on: ['normative', 'advisory'],
                    },
                },
            },
        })
        const enforcement = resolveEnforcement(config)
        expect(getEnforcementAction(enforcement, 'export_gate', 'coercive')).toBe('block')
        expect(getEnforcementAction(enforcement, 'export_gate', 'normative')).toBe('warn')
        expect(getEnforcementAction(enforcement, 'export_gate', 'advisory')).toBe('warn')
    })

    it('custom config can make coercive auto-fixable at a custom point', () => {
        const config = minimalConfig({
            enforcement: {
                points: {
                    aggressive_fix: {
                        apply_on: ['coercive', 'normative'],
                    },
                },
            },
        })
        const enforcement = resolveEnforcement(config)
        expect(getEnforcementAction(enforcement, 'aggressive_fix', 'coercive')).toBe('auto_fix')
        expect(getEnforcementAction(enforcement, 'aggressive_fix', 'normative')).toBe('auto_fix')
    })
})

// ── Integration: backward compatibility ───────────────────────────────────────

describe('integration — backward compatibility with pre-UCFG behaviour', () => {
    /**
     * Pre-UCFG hardcoded policy:
     *   - block_on_mithril: true  → Mithril violations block export
     *   - block_on_a11y: true     → A11y violations block export
     *   - Auto-fix was available for Mithril (normative) violations
     *   - CI gate failed on blocking violations, warned on others
     *   - Audit always reported everything, never blocked
     */

    it('export_gate blocks all violations that would have blocked in pre-UCFG (coercive + normative)', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'export_gate', 'coercive')).toBe('block')
        expect(getEnforcementAction(enforcement, 'export_gate', 'normative')).toBe('block')
    })

    it('export_gate does not block advisory (matches pre-UCFG warning-only for low severity)', () => {
        const enforcement = resolveEnforcement(undefined)
        const action = getEnforcementAction(enforcement, 'export_gate', 'advisory')
        expect(action).not.toBe('block')
    })

    it('auto_fix applies to normative violations (matches pre-UCFG Mithril auto-fix)', () => {
        const enforcement = resolveEnforcement(undefined)
        expect(getEnforcementAction(enforcement, 'auto_fix', 'normative')).toBe('auto_fix')
    })

    it('mcp_audit never returns block (matches pre-UCFG audit-does-not-gate behaviour)', () => {
        const enforcement = resolveEnforcement(undefined)
        const actions = ['coercive', 'normative', 'advisory'].map((m) =>
            getEnforcementAction(enforcement, 'mcp_audit', m as 'coercive' | 'normative' | 'advisory')
        )
        expect(actions).not.toContain('block')
    })

    it('resolving with empty config twice is deterministic', () => {
        const a = resolveEnforcement(undefined)
        const b = resolveEnforcement(undefined)
        expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })

    it('resolving with same config twice is deterministic', () => {
        const config = minimalConfig({
            enforcement: {
                points: { my_gate: { block_on: 'coercive' } },
            },
        })
        const a = resolveEnforcement(config)
        const b = resolveEnforcement(config)
        expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })
})
