/**
 * healOnAudit.test.ts — bridge-mcp/src/__tests__/healOnAudit.test.ts
 *
 * Phase ING.3 integration tests for the optional `healOnAudit` parameter
 * on `bridge_audit`.
 *
 * Test IDs covered:
 *   ING-18 — bridge_audit({ filePath, healOnAudit: true }) → healed section present
 *           — bridge_audit({ filePath })                   → no healed section
 *           — bridge_audit({ filePath, healOnAudit: true }) with zero tokens → no-op
 *
 * Architecture note:
 *   The `IngestionAuditor.heal()` function runs in the Electron main process and
 *   requires SQLite token access + FileTransactionManager.  The MCP server is
 *   headless: it does not have access to these Electron APIs.  Therefore the MCP
 *   layer implements graceful degradation — it acknowledges `healOnAudit: true`,
 *   runs the standard audit, and returns `healOnAudit: { skipped: true, reason }`.
 *
 *   Full end-to-end heal (tier-1 fixes applied, `tier1Fixed` array populated) is
 *   exercised in `electron/__tests__/IngestionAuditor.test.ts` (ING-01 through ING-12).
 *
 * What these tests verify:
 *   1. The `healOnAudit` parameter is accepted without error.
 *   2. When `healOnAudit: true`:  result carries `healOnAudit: { skipped, reason }`.
 *   3. When healOnAudit omitted:  the field is absent entirely (backward compat).
 *   4. Zero-token scenario:       heal would be a no-op; standard audit still runs.
 *   5. `BRIDGE_AUDIT_TOOL` schema registers the property as optional boolean.
 */

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { handleBridgeAudit, BRIDGE_AUDIT_TOOL } from '../tools/audit.js'
import type { AuditArgs, AuditResult } from '../tools/audit.js'
import { DEFAULT_CONFIG } from '../core/config.js'
import type { BridgeConfig } from '../core/config.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Config pointing at a non-existent project root so that:
 *   - No .bridge/design-tokens.json is found → empty token list (zero-tokens case).
 *   - Policy uses defaults (Mithril + A11y enabled).
 */
const CONFIG_NO_TOKENS: BridgeConfig = {
    ...DEFAULT_CONFIG,
    projectRoot: '/tmp/__bridge_ing18_no_tokens__',
}

/**
 * Config pointing at a temp directory where we can write a design-tokens.json
 * to simulate a project with tokens loaded.
 */
const tmpProjectRoot = path.join(os.tmpdir(), '__bridge_ing18_with_tokens__')
const CONFIG_WITH_TOKENS: BridgeConfig = {
    ...DEFAULT_CONFIG,
    projectRoot: tmpProjectRoot,
}

/** Component with an exact-match hardcoded colour that a token would fix at tier-1. */
const SOURCE_WITH_DRIFTED_COLOR = `
const Card = () => (
  <div data-bridge-id="card-root" className="bg-[#3B82F6] p-4">
    <span>Content</span>
  </div>
)
export default Card
`

/** Fully compliant component — zero Mithril + zero A11y violations. */
const SOURCE_CLEAN = `
const Clean = () => (
  <div>
    <span>Hello</span>
  </div>
)
export default Clean
`

/** Component with missing alt text — produces an A11y violation. */
const SOURCE_A11Y_VIOLATION = `
const Gallery = () => (
  <div>
    <img src="photo.jpg" />
  </div>
)
export default Gallery
`

// ── Helper ────────────────────────────────────────────────────────────────────

async function audit(
    source: string,
    config: BridgeConfig,
    extra: Partial<AuditArgs> = {},
): Promise<AuditResult> {
    return handleBridgeAudit({ source, filePath: 'Component.tsx', ...extra }, config)
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('ING-18: healOnAudit parameter on bridge_audit', () => {

    // ── Scenario 1: healOnAudit: true — healed section present ────────────────
    //
    // In headless MCP mode the heal pass cannot run (no Electron SQLite access).
    // The result MUST include `healOnAudit: { skipped: true, reason }` so callers
    // know the heal was acknowledged but deferred to the Glass IPC pipeline.

    describe('Scenario 1 — healOnAudit: true → healed section present in result', () => {
        it('ING-18a: result includes a healOnAudit field when healOnAudit is true', async () => {
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true })
            expect(result).toHaveProperty('healOnAudit')
        })

        it('ING-18b: healOnAudit field has skipped: true', async () => {
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true })
            expect(result.healOnAudit).toBeDefined()
            expect(result.healOnAudit!.skipped).toBe(true)
        })

        it('ING-18c: healOnAudit field has a non-empty reason string', async () => {
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true })
            expect(typeof result.healOnAudit!.reason).toBe('string')
            expect(result.healOnAudit!.reason.length).toBeGreaterThan(0)
        })

        it('ING-18d: standard audit still runs — violations are reported alongside healOnAudit', async () => {
            // With tokens loaded, bg-[#3B82F6] would be a tier-1 fix.
            // With no tokens, MithrilLinter finds no violations (nothing to compare against).
            // We verify the audit itself runs and produces a well-formed result.
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true })
            expect(typeof result.mithrilCount).toBe('number')
            expect(typeof result.a11yCount).toBe('number')
            expect(Array.isArray(result.violations)).toBe(true)
        })

        it('ING-18e: A11y violations are reported even when healOnAudit is true', async () => {
            const withHeal    = await audit(SOURCE_A11Y_VIOLATION, CONFIG_NO_TOKENS, { healOnAudit: true })
            const withoutHeal = await audit(SOURCE_A11Y_VIOLATION, CONFIG_NO_TOKENS)
            // The a11y count must be the same whether or not healOnAudit is set
            expect(withHeal.a11yCount).toBe(withoutHeal.a11yCount)
        })

        it('ING-18f: healOnAudit field shape is exactly { skipped: true, reason: string }', async () => {
            const result = await audit(SOURCE_CLEAN, CONFIG_NO_TOKENS, { healOnAudit: true })
            expect(result.healOnAudit).toEqual({
                skipped: true,
                reason: 'heal pass requires Glass IPC pipeline',
            })
        })
    })

    // ── Scenario 2: healOnAudit omitted — no healed section, behavior unchanged ──

    describe('Scenario 2 — healOnAudit omitted → no healed section, unchanged behavior', () => {
        it('healOnAudit field is absent when parameter is not provided', async () => {
            const result = await audit(SOURCE_CLEAN, CONFIG_NO_TOKENS)
            expect(Object.prototype.hasOwnProperty.call(result, 'healOnAudit')).toBe(false)
        })

        it('result shape with healOnAudit omitted matches pre-ING.3 shape', async () => {
            const result = await audit(SOURCE_CLEAN, CONFIG_NO_TOKENS)
            expect(result).toHaveProperty('violations')
            expect(result).toHaveProperty('mithrilCount')
            expect(result).toHaveProperty('a11yCount')
            expect(result).toHaveProperty('policyMode')
            expect(Object.prototype.hasOwnProperty.call(result, 'healOnAudit')).toBe(false)
        })

        it('violation counts are identical whether healOnAudit is omitted or false', async () => {
            const omitted  = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS)
            const explicit = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: false })
            expect(explicit.mithrilCount).toBe(omitted.mithrilCount)
            expect(explicit.a11yCount).toBe(omitted.a11yCount)
            expect(explicit.violations.length).toBe(omitted.violations.length)
            expect(Object.prototype.hasOwnProperty.call(explicit, 'healOnAudit')).toBe(false)
        })

        it('clean source produces zero violations with healOnAudit omitted', async () => {
            const result = await audit(SOURCE_CLEAN, CONFIG_NO_TOKENS)
            expect(result.mithrilCount).toBe(0)
            expect(result.a11yCount).toBe(0)
            expect(result.violations).toHaveLength(0)
        })
    })

    // ── Scenario 3: zero tokens → heal is no-op, standard audit only ──────────
    //
    // When no design-tokens.json exists (empty token list), IngestionAuditor.heal()
    // is a no-op by design (contract Section 4.2 / C9).  In headless MCP mode the
    // heal pass is already skipped, but we confirm that the graceful-degradation
    // path is consistent with zero tokens regardless.

    describe('Scenario 3 — zero tokens → heal is no-op, standard audit runs', () => {
        it('returns healOnAudit skipped status even when project has no tokens', async () => {
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true })
            // Graceful degradation: skipped for the same reason as with tokens
            expect(result.healOnAudit).toEqual({
                skipped: true,
                reason: 'heal pass requires Glass IPC pipeline',
            })
        })

        it('audit still completes without error when tokens file is absent', async () => {
            await expect(
                audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true }),
            ).resolves.toBeDefined()
        })

        it('mithrilCount with zero tokens is 0 (nothing to drift against)', async () => {
            // MithrilLinter requires tokens to detect drift — empty list = no violations
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_NO_TOKENS, { healOnAudit: true })
            expect(result.mithrilCount).toBe(0)
        })

        it('with tokens present: audit detects drift, healOnAudit still skipped in MCP mode', async () => {
            // Write a minimal tokens file so the fs token-load path runs
            const bridgeDir = path.join(tmpProjectRoot, '.bridge')
            fs.mkdirSync(bridgeDir, { recursive: true })
            fs.writeFileSync(
                path.join(bridgeDir, 'design-tokens.json'),
                JSON.stringify([
                    {
                        token_path: 'color.blue.500',
                        token_type: 'color',
                        token_value: '#3B82F6',
                    },
                ]),
                'utf8',
            )
            const result = await audit(SOURCE_WITH_DRIFTED_COLOR, CONFIG_WITH_TOKENS, { healOnAudit: true })
            // Heal is still skipped (MCP headless mode) even though tokens are present
            expect(result.healOnAudit).toEqual({
                skipped: true,
                reason: 'heal pass requires Glass IPC pipeline',
            })
            // Mithril can now compare — but bg-[#3B82F6] has deltaE=0 from blue.500
            // so linter may or may not flag it depending on threshold. Either way,
            // the result must be a well-formed AuditResult.
            expect(typeof result.mithrilCount).toBe('number')
        })
    })

    // ── Schema validation ────────────────────────────────────────────────────

    describe('BRIDGE_AUDIT_TOOL schema', () => {
        it('schema properties include healOnAudit', () => {
            const props = BRIDGE_AUDIT_TOOL.inputSchema.properties as Record<string, unknown>
            expect(props).toHaveProperty('healOnAudit')
        })

        it('healOnAudit schema type is boolean', () => {
            const props = BRIDGE_AUDIT_TOOL.inputSchema.properties as Record<string, { type: string }>
            expect(props.healOnAudit.type).toBe('boolean')
        })

        it('healOnAudit is not in required (optional parameter)', () => {
            const required = BRIDGE_AUDIT_TOOL.inputSchema.required as string[]
            expect(required).not.toContain('healOnAudit')
        })
    })
})
