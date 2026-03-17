/**
 * Phase ING.3 — bridge_audit healOnAudit parameter tests
 * bridge-mcp/src/__tests__/audit-heal.test.ts
 *
 * Test ID: ING-18
 *
 * Validates the schema extension and graceful-degradation behaviour of the
 * optional `healOnAudit` parameter on `handleBridgeAudit`.
 *
 * Since the MCP server runs headlessly (no Electron main process / no SQLite
 * token access), the heal pass is always skipped.  The contract requires:
 *   1. The parameter is accepted without throwing.
 *   2. The audit result carries `healOnAudit: { skipped: true, reason: '...' }`.
 *   3. Callers that omit `healOnAudit` receive identical output to the
 *      pre-ING.3 behaviour (the field is absent).
 *   4. `healOnAudit: false` is treated as omitted (no extra field in result).
 *   5. The violations array is populated normally regardless of healOnAudit.
 *
 * No disk I/O.  All sources are in-memory.
 */

import { describe, it, expect } from 'vitest'
import { handleBridgeAudit, BRIDGE_AUDIT_TOOL } from '../tools/audit.js'
import type { AuditArgs, AuditResult } from '../tools/audit.js'
import { DEFAULT_CONFIG } from '../core/config.js'
import type { BridgeConfig } from '../core/config.js'

// ── Shared fixtures ────────────────────────────────────────────────────────────

/**
 * Minimal BridgeConfig that enables both Mithril and A11y auditing with default
 * thresholds.  Uses a non-existent projectRoot so the fs token load silently
 * returns an empty array (matching headless MCP behaviour).
 */
const config: BridgeConfig = {
    ...DEFAULT_CONFIG,
    projectRoot: '/tmp/__bridge_test_nonexistent__',
}

/**
 * A fully compliant component — no arbitrary colours, valid alt text.
 * Expected: zero violations regardless of healOnAudit.
 */
const CLEAN_SOURCE = `
const Clean = () => (
  <div aria-label="Section">
    <img src="logo.svg" alt="Company logo" />
    <button type="button" aria-label="Open menu">Menu</button>
  </div>
)
export default Clean
`

/**
 * Component with a hardcoded colour class.
 * bg-[#ff0000] — the MithrilLinter will check this against the (empty) token
 * list.  With an empty token set the linter produces no warnings, so this
 * source is useful for confirming that healOnAudit does not alter counts.
 */
const DRIFTED_SOURCE = `
const Drifted = () => (
  <div data-bridge-id="drifted-root" className="bg-[#ff0000]">
    <span>Brand violation</span>
  </div>
)
export default Drifted
`

async function audit(source: string, extra: Partial<AuditArgs> = {}): Promise<AuditResult> {
    return handleBridgeAudit({ source, filePath: 'Test.tsx', ...extra }, config)
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('ING-18: bridge_audit healOnAudit parameter — graceful degradation in headless MCP mode', () => {

    // ── 1. Backward compatibility — healOnAudit omitted ────────────────────────

    describe('1. Backward compatibility — healOnAudit omitted', () => {
        it('returns a valid AuditResult without the healOnAudit field when param is not provided', async () => {
            const result = await audit(CLEAN_SOURCE)
            expect(result).toHaveProperty('violations')
            expect(result).toHaveProperty('mithrilCount')
            expect(result).toHaveProperty('a11yCount')
            expect(result).toHaveProperty('policyMode')
            // The field must be absent entirely
            expect(Object.prototype.hasOwnProperty.call(result, 'healOnAudit')).toBe(false)
        })

        it('violation counts are correct when healOnAudit is omitted (clean source)', async () => {
            const result = await audit(CLEAN_SOURCE)
            expect(result.mithrilCount).toBe(0)
            expect(result.a11yCount).toBe(0)
            expect(result.violations).toHaveLength(0)
        })

        it('function resolves successfully when healOnAudit is omitted (drifted source)', async () => {
            const result = await audit(DRIFTED_SOURCE)
            expect(result).toBeDefined()
            expect(typeof result.mithrilCount).toBe('number')
            expect(typeof result.a11yCount).toBe('number')
        })
    })

    // ── 2. healOnAudit: true — skipped with reason field ───────────────────────

    describe('2. healOnAudit: true — acknowledged and skipped in headless mode', () => {
        it('returns healOnAudit: { skipped: true } when healOnAudit is true', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: true })
            expect(result.healOnAudit).toBeDefined()
            expect(result.healOnAudit!.skipped).toBe(true)
        })

        it('includes a non-empty reason string describing the limitation', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: true })
            expect(typeof result.healOnAudit!.reason).toBe('string')
            expect(result.healOnAudit!.reason.length).toBeGreaterThan(0)
        })

        it('reason communicates that the Glass IPC pipeline is required', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: true })
            expect(result.healOnAudit!.reason).toBe('heal pass requires Glass IPC pipeline')
        })

        it('audit still runs normally when healOnAudit is true — clean source has zero violations', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: true })
            expect(result.mithrilCount).toBe(0)
            expect(result.a11yCount).toBe(0)
            expect(result.violations).toHaveLength(0)
        })

        it('healOnAudit does not suppress violations — counts match baseline', async () => {
            const baseline = await audit(DRIFTED_SOURCE)
            const withHeal = await audit(DRIFTED_SOURCE, { healOnAudit: true })
            expect(withHeal.mithrilCount).toBe(baseline.mithrilCount)
            expect(withHeal.a11yCount).toBe(baseline.a11yCount)
            expect(withHeal.violations.length).toBe(baseline.violations.length)
        })

        it('policyMode is present in result even when healOnAudit is true', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: true })
            expect(result.policyMode).toBeDefined()
            expect(typeof result.policyMode.mithril).toBe('string')
            expect(typeof result.policyMode.a11y).toBe('string')
        })

        it('healOnAudit field is exactly { skipped: true, reason: "..." }', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: true })
            expect(result.healOnAudit).toEqual({
                skipped: true,
                reason: 'heal pass requires Glass IPC pipeline',
            })
        })
    })

    // ── 3. healOnAudit: false — treated as omitted ─────────────────────────────

    describe('3. healOnAudit: false — no extra field in result', () => {
        it('does not add healOnAudit field when healOnAudit is explicitly false', async () => {
            const result = await audit(CLEAN_SOURCE, { healOnAudit: false })
            expect(Object.prototype.hasOwnProperty.call(result, 'healOnAudit')).toBe(false)
        })

        it('result shape with healOnAudit: false is identical to omitting the param', async () => {
            const omitted = await audit(CLEAN_SOURCE)
            const falsy   = await audit(CLEAN_SOURCE, { healOnAudit: false })
            expect(falsy.mithrilCount).toBe(omitted.mithrilCount)
            expect(falsy.a11yCount).toBe(omitted.a11yCount)
            expect(falsy.violations).toEqual(omitted.violations)
            expect(Object.prototype.hasOwnProperty.call(falsy, 'healOnAudit')).toBe(false)
        })
    })

    // ── 4. Schema sanity — BRIDGE_AUDIT_TOOL includes the new property ─────────

    describe('4. BRIDGE_AUDIT_TOOL schema includes healOnAudit property', () => {
        it('BRIDGE_AUDIT_TOOL.inputSchema.properties contains healOnAudit', () => {
            const props = BRIDGE_AUDIT_TOOL.inputSchema.properties as Record<string, unknown>
            expect(props).toHaveProperty('healOnAudit')
        })

        it('healOnAudit schema property has type boolean', () => {
            const props = BRIDGE_AUDIT_TOOL.inputSchema.properties as Record<string, { type: string }>
            expect(props.healOnAudit.type).toBe('boolean')
        })

        it('healOnAudit is not in the required array (it is optional)', () => {
            const required = BRIDGE_AUDIT_TOOL.inputSchema.required as string[]
            expect(required).not.toContain('healOnAudit')
        })

        it('existing required fields are unchanged', () => {
            const required = BRIDGE_AUDIT_TOOL.inputSchema.required as string[]
            expect(required).toContain('source')
            expect(required).toContain('filePath')
        })
    })

    // ── 5. Error resilience — edge cases ──────────────────────────────────────

    describe('5. Error resilience', () => {
        it('does not throw when source is an empty string and healOnAudit is true', async () => {
            await expect(audit('', { healOnAudit: true })).resolves.toBeDefined()
        })

        it('returns healOnAudit skipped status for minimal valid JSX', async () => {
            const result = await audit('const A = () => <div />', { healOnAudit: true })
            expect(result.healOnAudit).toEqual({
                skipped: true,
                reason: 'heal pass requires Glass IPC pipeline',
            })
        })

        it('healOnAudit: true does not prevent a11y violations from being reported', async () => {
            const missingAltSource = `
const NoAlt = () => (
  <div>
    <img src="photo.png" />
  </div>
)
export default NoAlt
`
            const withHeal    = await audit(missingAltSource, { healOnAudit: true })
            const withoutHeal = await audit(missingAltSource)
            // a11y violations must be the same regardless of healOnAudit
            expect(withHeal.a11yCount).toBe(withoutHeal.a11yCount)
            expect(withHeal.violations.filter(v => v.type === 'a11y').length)
                .toBe(withoutHeal.violations.filter(v => v.type === 'a11y').length)
        })
    })
})
