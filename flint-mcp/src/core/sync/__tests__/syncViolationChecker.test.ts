import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'
import { TokenSourceService } from '../tokenSourceService.js'
import { checkSyncViolations, type DesignTokenFileEntry } from '../syncViolationChecker.js'

const PROJECT = '/test/project'

describe('syncViolationChecker', () => {
    let db: BetterSqlite3.Database

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
    })

    function seedBaseline(tokens: Array<{ name: string; value: string; source: 'figma' | 'local'; figmaVarId?: string }>) {
        const svc = new TokenSourceService(db)
        svc.updateBaseline(
            PROJECT,
            tokens.map((t) => ({
                tokenName: t.name,
                tokenValue: t.value,
                source: t.source,
                figmaVariableId: t.figmaVarId ?? null,
            })),
        )
    }

    describe('SYNC-001: Token Out of Sync', () => {
        it('fires for color token with ΔE > 2.0', () => {
            // Seed baseline with red from Figma
            seedBaseline([{ name: 'color.primary', value: '#ff0000', source: 'figma', figmaVarId: 'var:1' }])

            // Local token drifted to blue
            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.primary', token_type: 'color', token_value: '#0000ff' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(1)
            expect(warnings[0].ruleId).toBe('SYNC-001')
            expect(warnings[0].type).toBe('sync')
            expect(warnings[0].severity).toBe('amber')
            expect(warnings[0].value).toBeGreaterThan(2.0)
            expect(warnings[0].message).toContain('color.primary')
            expect(warnings[0].message).toContain('ΔE')
        })

        it('passes for color token within ΔE tolerance', () => {
            // Very similar colors
            seedBaseline([{ name: 'color.primary', value: '#ff0000', source: 'figma', figmaVarId: 'var:1' }])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.primary', token_type: 'color', token_value: '#ff0101' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(0)
        })

        it('fires for non-color token value mismatch', () => {
            seedBaseline([{ name: 'spacing.md', value: '16px', source: 'figma', figmaVarId: 'var:2' }])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'spacing.md', token_type: 'dimension', token_value: '24px' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(1)
            expect(warnings[0].ruleId).toBe('SYNC-001')
            expect(warnings[0].message).toContain('24px')
            expect(warnings[0].message).toContain('16px')
        })

        it('passes for non-color token with matching value', () => {
            seedBaseline([{ name: 'spacing.md', value: '16px', source: 'figma', figmaVarId: 'var:2' }])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'spacing.md', token_type: 'dimension', token_value: '16px' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(0)
        })
    })

    describe('SYNC-002: Orphaned Token', () => {
        it('fires when token has no figma mapping', () => {
            // No baseline at all
            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.custom', token_type: 'color', token_value: '#abcdef' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(1)
            expect(warnings[0].ruleId).toBe('SYNC-002')
            expect(warnings[0].type).toBe('sync')
            expect(warnings[0].severity).toBe('advisory')
            expect(warnings[0].message).toContain('color.custom')
            expect(warnings[0].message).toContain('no Figma variable mapping')
        })

        it('fires when baseline source is local (not figma)', () => {
            seedBaseline([{ name: 'color.local', value: '#111111', source: 'local' }])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.local', token_type: 'color', token_value: '#111111' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(1)
            expect(warnings[0].ruleId).toBe('SYNC-002')
        })

        it('passes when token has figma mapping', () => {
            seedBaseline([{ name: 'color.primary', value: '#ff0000', source: 'figma', figmaVarId: 'var:1' }])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.primary', token_type: 'color', token_value: '#ff0000' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(0)
        })
    })

    describe('mixed scenarios', () => {
        it('returns both SYNC-001 and SYNC-002 for different tokens', () => {
            seedBaseline([
                { name: 'color.primary', value: '#ff0000', source: 'figma', figmaVarId: 'var:1' },
            ])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.primary', token_type: 'color', token_value: '#0000ff' }, // diverged
                { token_path: 'color.orphan', token_type: 'color', token_value: '#333333' },  // no mapping
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            const ruleIds = warnings.map((w) => w.ruleId)
            expect(ruleIds).toContain('SYNC-001')
            expect(ruleIds).toContain('SYNC-002')
        })

        it('returns empty array when all tokens are in sync', () => {
            seedBaseline([
                { name: 'color.primary', value: '#ff0000', source: 'figma', figmaVarId: 'var:1' },
                { name: 'spacing.md', value: '16px', source: 'figma', figmaVarId: 'var:2' },
            ])

            const localTokens: DesignTokenFileEntry[] = [
                { token_path: 'color.primary', token_type: 'color', token_value: '#ff0000' },
                { token_path: 'spacing.md', token_type: 'dimension', token_value: '16px' },
            ]

            const warnings = checkSyncViolations(localTokens, db, PROJECT)
            expect(warnings).toHaveLength(0)
        })
    })
})
