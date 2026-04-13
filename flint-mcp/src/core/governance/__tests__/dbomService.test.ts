/**
 * DBOM Service Tests — flint-mcp/src/core/governance/__tests__/dbomService.test.ts
 *
 * Tests for the governance-enriched Design Bill of Materials generator.
 * Covers: empty project, project with tokens + components + violations,
 * CycloneDX format, provenance toggle, posture calculation accuracy,
 * token compliance status, component source inference, and disk write.
 *
 * Phase: DBOM.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { generateDBOM, formatDBOMOutput } from '../dbomService.js'
import type { DBOM } from '../types.js'

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeTmpProject(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-dbom-gov-'))
    fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
    return tmpDir
}

function writeSrc(tmpDir: string, name: string, content: string): void {
    fs.writeFileSync(path.join(tmpDir, 'src', name), content, 'utf-8')
}

function writeTokens(tmpDir: string, tokens: object[]): void {
    fs.writeFileSync(
        path.join(tmpDir, '.flint', 'design-tokens.json'),
        JSON.stringify(tokens, null, 2),
        'utf-8',
    )
}

function writePolicy(tmpDir: string, policy: object): void {
    fs.writeFileSync(
        path.join(tmpDir, '.flint', 'policy.json'),
        JSON.stringify(policy, null, 2),
        'utf-8',
    )
}

function cleanup(tmpDir: string): void {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 })
    } catch {
        // APFS cleanup fallback
    }
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CLEAN_COMPONENT = `
export function Button() {
    return (
        <button
            data-flint-id="btn-001"
            className="bg-blue-500 text-white rounded px-4 py-2"
        >
            Click me
        </button>
    )
}
`

const A11Y_VIOLATION_COMPONENT = `
export function ImageCard() {
    return (
        <div data-flint-id="card-001">
            <img src="/logo.png" data-flint-id="img-001" />
        </div>
    )
}
`

const ARBITRARY_COLOR_COMPONENT = `
export function HeroSection() {
    return (
        <div
            data-flint-id="hero-001"
            className="bg-[#ff0000] text-white"
        >
            Hero
        </div>
    )
}
`

const TOKEN_FIXTURES = [
    {
        id: 1,
        token_path: 'colors.brand.primary',
        token_type: 'color',
        token_value: '#1A73E8',
        description: null,
        collection_name: 'Primitives',
        mode: 'default',
    },
    {
        id: 2,
        token_path: 'spacing.sm',
        token_type: 'dimension',
        token_value: '8px',
        description: null,
        collection_name: 'Primitives',
        mode: 'default',
    },
]

// ── Tests: Empty project ────────────────────────────────────────────────────

describe('DBOM governance — empty project', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('returns a valid DBOM with version 1.0 for an empty project', async () => {
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.version).toBe('1.0')
        expect(dbom.generatedAt).toBeTruthy()
        expect(dbom.flintVersion).toBe('1.0.0')
        expect(dbom.projectRoot).toBe(tmpDir)
    })

    it('returns empty tokens and components arrays', async () => {
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.tokens).toEqual([])
        expect(dbom.components).toEqual([])
    })

    it('returns zero violations in posture', async () => {
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.posture.totalViolations).toBe(0)
        expect(dbom.posture.totalTokens).toBe(0)
        expect(dbom.posture.totalComponents).toBe(0)
    })

    it('returns healthScore=100 and grade=A for empty project', async () => {
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.posture.healthScore).toBe(100)
        expect(dbom.posture.grade).toBe('A')
    })

    it('returns empty complianceByAuthority for zero violations', async () => {
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.posture.complianceByAuthority).toEqual({})
    })

    it('includes a summary string', async () => {
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(typeof dbom.summary).toBe('string')
        expect(dbom.summary.length).toBeGreaterThan(10)
    })
})

// ── Tests: Project with tokens + components + violations ────────────────────

describe('DBOM governance — project with data', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('counts tokens correctly', async () => {
        writeTokens(tmpDir, TOKEN_FIXTURES)
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.tokens).toHaveLength(2)
        expect(dbom.posture.totalTokens).toBe(2)
    })

    it('counts components correctly', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        writeSrc(tmpDir, 'Hero.tsx', ARBITRARY_COLOR_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.components).toHaveLength(2)
        expect(dbom.posture.totalComponents).toBe(2)
    })

    it('detects A11y violations in posture', async () => {
        writeSrc(tmpDir, 'ImageCard.tsx', A11Y_VIOLATION_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.posture.totalViolations).toBeGreaterThan(0)
    })

    it('sets component auditResult.violations > 0 for A11y-violating component', async () => {
        writeSrc(tmpDir, 'ImageCard.tsx', A11Y_VIOLATION_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const comp = dbom.components.find((c) => c.name === 'ImageCard')
        expect(comp).toBeDefined()
        expect(comp!.auditResult.violations).toBeGreaterThan(0)
    })

    it('sets component auditResult.score < 100 for violating component', async () => {
        writeSrc(tmpDir, 'ImageCard.tsx', A11Y_VIOLATION_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const comp = dbom.components.find((c) => c.name === 'ImageCard')
        expect(comp!.auditResult.score).toBeLessThan(100)
    })

    it('sets component auditResult.score = 100 for clean component', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const comp = dbom.components.find((c) => c.name === 'Button')
        expect(comp!.auditResult.score).toBe(100)
    })

    it('populates complianceByAuthority when violations exist', async () => {
        writeSrc(tmpDir, 'ImageCard.tsx', A11Y_VIOLATION_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        // A11y violations trace to WCAG authorities via GOV.1 provenance
        const authorityValues = Object.values(dbom.posture.complianceByAuthority)
        expect(authorityValues.length).toBeGreaterThan(0)
        expect(authorityValues.some((v) => v > 0)).toBe(true)
    })

    it('marks component source as handwritten when no provenance exists', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const comp = dbom.components.find((c) => c.name === 'Button')
        expect(comp!.source).toBe('handwritten')
    })

    it('infers figma source from file path heuristic', async () => {
        // Create a figma-named directory
        fs.mkdirSync(path.join(tmpDir, 'src', 'figma'), { recursive: true })
        fs.writeFileSync(
            path.join(tmpDir, 'src', 'figma', 'FigmaCard.tsx'),
            CLEAN_COMPONENT,
            'utf-8',
        )
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const comp = dbom.components.find((c) => c.name === 'FigmaCard')
        expect(comp!.source).toBe('figma')
    })
})

// ── Tests: Token compliance status ──────────────────────────────────────────

describe('DBOM governance — token compliance', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('marks unused tokens as unknown', async () => {
        const tokens = [
            {
                id: 1,
                token_path: 'colors.exotic.rare',
                token_type: 'color',
                token_value: '#abcdef',
                description: null,
                collection_name: 'default',
                mode: 'default',
            },
        ]
        writeTokens(tmpDir, tokens)
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const tok = dbom.tokens.find((t) => t.name === 'colors.exotic.rare')
        expect(tok!.complianceStatus).toBe('unknown')
    })

    it('preserves token name, value, and category', async () => {
        writeTokens(tmpDir, TOKEN_FIXTURES)
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const tok = dbom.tokens.find((t) => t.name === 'colors.brand.primary')
        expect(tok).toBeDefined()
        expect(tok!.value).toBe('#1A73E8')
        expect(tok!.category).toBe('color')
    })

    it('usedInFiles is an array for every token', async () => {
        writeTokens(tmpDir, TOKEN_FIXTURES)
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        for (const tok of dbom.tokens) {
            expect(Array.isArray(tok.usedInFiles)).toBe(true)
        }
    })
})

// ── Tests: CycloneDX format ─────────────────────────────────────────────────

describe('DBOM governance — CycloneDX format', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('wraps DBOM in CycloneDX 1.5 envelope', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { format: 'cyclonedx', dryRun: true })
        const output = formatDBOMOutput(dbom, 'cyclonedx')
        const parsed = JSON.parse(output)

        expect(parsed.bomFormat).toBe('CycloneDX')
        expect(parsed.specVersion).toBe('1.5')
        expect(parsed.version).toBe(1)
        expect(parsed.serialNumber).toMatch(/^urn:uuid:/)
    })

    it('includes metadata with tools and timestamp', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { format: 'cyclonedx', dryRun: true })
        const parsed = JSON.parse(formatDBOMOutput(dbom, 'cyclonedx'))

        expect(parsed.metadata.tools).toHaveLength(1)
        expect(parsed.metadata.tools[0].name).toBe('flint-mcp')
        expect(typeof parsed.metadata.timestamp).toBe('string')
    })

    it('maps components to CycloneDX component entries', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        writeSrc(tmpDir, 'Hero.tsx', ARBITRARY_COLOR_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { format: 'cyclonedx', dryRun: true })
        const parsed = JSON.parse(formatDBOMOutput(dbom, 'cyclonedx'))

        expect(parsed.components).toHaveLength(2)
        expect(parsed.components[0].type).toBe('library')
        expect(parsed.components[0].properties).toBeDefined()
    })

    it('embeds the full DBOM as a JSON string property (CycloneDX 1.5 compliant)', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { format: 'cyclonedx', dryRun: true })
        const parsed = JSON.parse(formatDBOMOutput(dbom, 'cyclonedx'))

        const dbomProp = parsed.properties.find((p: { name: string }) => p.name === 'flint:dbom')
        expect(dbomProp).toBeDefined()
        const embeddedDbom = JSON.parse(dbomProp.value)
        expect(embeddedDbom.version).toBe('1.0')
        expect(embeddedDbom.posture).toBeDefined()
    })

    it('includes flint properties at top level', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { format: 'cyclonedx', dryRun: true })
        const parsed = JSON.parse(formatDBOMOutput(dbom, 'cyclonedx'))

        const propNames = parsed.properties.map((p: { name: string }) => p.name)
        expect(propNames).toContain('flint:healthScore')
        expect(propNames).toContain('flint:grade')
        expect(propNames).toContain('flint:totalViolations')
    })
})

// ── Tests: Provenance inclusion toggle ──────────────────────────────────────

describe('DBOM governance — provenance toggle', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('omits provenance when includeProvenance=false', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, {
            includeProvenance: false,
            dryRun: true,
        })
        for (const comp of dbom.components) {
            expect(comp.provenance).toBeUndefined()
        }
    })

    it('includes provenance when includeProvenance=true (empty when no DB)', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, {
            includeProvenance: true,
            dryRun: true,
        })
        for (const comp of dbom.components) {
            expect(comp.provenance).toBeDefined()
            // No provenance DB exists, so defaults to zero
            expect(comp.provenance!.totalMutations).toBe(0)
            expect(comp.provenance!.bySource).toEqual({})
            expect(comp.provenance!.lastMutatedAt).toBeNull()
        }
    })
})

// ── Tests: Posture calculation accuracy ─────────────────────────────────────

describe('DBOM governance — posture accuracy', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('healthScore decreases with violations', async () => {
        writeSrc(tmpDir, 'ImageCard.tsx', A11Y_VIOLATION_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(dbom.posture.healthScore).toBeLessThan(100)
    })

    it('grade is F for many violations', async () => {
        // Multiple files with A11y violations
        for (let i = 0; i < 8; i++) {
            writeSrc(tmpDir, `BadComponent${i}.tsx`, A11Y_VIOLATION_COMPONENT)
        }
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        expect(['D', 'F']).toContain(dbom.posture.grade)
    })

    it('totalViolations equals sum of all component violations', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        writeSrc(tmpDir, 'ImageCard.tsx', A11Y_VIOLATION_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })

        const manualSum = dbom.components.reduce(
            (sum, c) => sum + c.auditResult.violations,
            0,
        )
        expect(dbom.posture.totalViolations).toBe(manualSum)
    })
})

// ── Tests: Disk write ───────────────────────────────────────────────────────

describe('DBOM governance — disk write', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('writes .flint/dbom.json when dryRun is false', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        await generateDBOM(tmpDir, { dryRun: false })

        const outputPath = path.join(tmpDir, '.flint', 'dbom.json')
        expect(fs.existsSync(outputPath)).toBe(true)

        const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'))
        expect(content.version).toBe('1.0')
        expect(content.posture).toBeDefined()
    })

    it('does not write .flint/dbom.json when dryRun is true', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        await generateDBOM(tmpDir, { dryRun: true })

        const outputPath = path.join(tmpDir, '.flint', 'dbom.json')
        expect(fs.existsSync(outputPath)).toBe(false)
    })

    it('creates .flint/ directory if missing when writing', async () => {
        // Remove .flint to test creation
        fs.rmSync(path.join(tmpDir, '.flint'), { recursive: true, force: true })
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        await generateDBOM(tmpDir, { dryRun: false })

        const outputPath = path.join(tmpDir, '.flint', 'dbom.json')
        expect(fs.existsSync(outputPath)).toBe(true)
    })
})

// ── Tests: formatDBOMOutput ─────────────────────────────────────────────────

describe('formatDBOMOutput', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpProject()
    })

    afterEach(() => {
        cleanup(tmpDir)
    })

    it('returns valid JSON for format=json', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const output = formatDBOMOutput(dbom, 'json')
        const parsed = JSON.parse(output)
        expect(parsed.version).toBe('1.0')
    })

    it('returns CycloneDX envelope for format=cyclonedx', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const output = formatDBOMOutput(dbom, 'cyclonedx')
        const parsed = JSON.parse(output)
        expect(parsed.bomFormat).toBe('CycloneDX')
    })

    it('defaults to json when format is omitted', async () => {
        writeSrc(tmpDir, 'Button.tsx', CLEAN_COMPONENT)
        const dbom = await generateDBOM(tmpDir, { dryRun: true })
        const output = formatDBOMOutput(dbom)
        const parsed = JSON.parse(output)
        expect(parsed.version).toBe('1.0')
        expect(parsed.bomFormat).toBeUndefined()
    })
})
