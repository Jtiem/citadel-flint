/**
 * EN.1 — flint_enrich_registry + flint_approve_enrichment tests
 *
 * All filesystem access is mocked via vi.mock('node:fs') so the tests are
 * hermetic and do not touch the real disk.
 *
 * 12 required tests:
 *  1. flint_enrich_registry returns bare components with source code
 *  2. flint_enrich_registry skips enriched components when overwrite=false
 *  3. flint_enrich_registry includes enriched components when overwrite=true
 *  4. flint_enrich_registry filters to single component when componentName provided
 *  5. flint_enrich_registry returns instructions string
 *  6. flint_enrich_registry handles missing manifest gracefully
 *  7. flint_approve_enrichment merges draft into manifest
 *  8. flint_approve_enrichment respects editedFields overrides
 *  9. flint_approve_enrichment with action=dismiss removes draft
 * 10. flint_approve_enrichment returns error for nonexistent draft
 * 11. saveDraft creates .flint/ directory if needed
 * 12. removeDraft returns correct remaining count
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock node:fs BEFORE importing anything that uses it
vi.mock('node:fs')

import fs from 'node:fs'
import { handleEnrichRegistry } from '../tools/enrich.js'
import { handleApproveEnrichment } from '../tools/enrich.js'
import {
    saveDraft,
    removeDraft,
    readDrafts,
    getDraft,
} from '../core/enrichmentDraftService.js'
import type { EnrichmentDraft } from '../core/enrichmentDraftService.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/tmp/test-project'

const BARE_MANIFEST = JSON.stringify({
    components: {
        Button: {
            name: 'Button',
            importPath: '@/components/ui/Button',
            props: { variant: { type: 'string', required: false } },
            variants: ['primary', 'secondary'],
            tokens: ['color.brand.primary'],
        },
        Modal: {
            name: 'Modal',
            importPath: '@/components/ui/Modal',
            props: {},
            variants: [],
            tokens: [],
        },
    },
})

const ENRICHED_MANIFEST = JSON.stringify({
    components: {
        Button: {
            name: 'Button',
            importPath: '@/components/ui/Button',
            description: 'A primary action button.',
            usageExample: '<Button variant="primary">Click me</Button>',
            props: { variant: { type: 'string', required: false } },
        },
        Modal: {
            name: 'Modal',
            importPath: '@/components/ui/Modal',
            props: {},
        },
    },
})

const BUTTON_SOURCE = `export function Button({ variant }) { return <button className={variant}>click</button> }`

const SAMPLE_DRAFT: EnrichmentDraft = {
    description: 'A reusable button component.',
    usageExample: '<Button variant="primary">Submit</Button>',
    compositionNotes: 'Use inside forms.',
    a11yNotes: 'Ensure aria-label is set.',
    relatedComponents: ['IconButton'],
    confidence: 'high',
    usageFileCount: 3,
    sourceFile: 'src/components/ui/Button.tsx',
    generatedAt: '2026-03-20T00:00:00.000Z',
    generatedBy: 'test-agent',
}

const DRAFTS_FILE = JSON.stringify({
    generatedAt: '2026-03-20T00:00:00.000Z',
    generatedBy: 'test-agent',
    drafts: {
        Button: SAMPLE_DRAFT,
    },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockFs = vi.mocked(fs)

function setupManifest(manifestJson: string, sourceCode = BUTTON_SOURCE) {
    mockFs.existsSync = vi.fn().mockImplementation((p: unknown) => {
        const fp = String(p)
        if (fp.endsWith('flint-manifest.json')) return true
        if (fp.endsWith('enrichment-drafts.json')) return false
        if (fp.endsWith('Button.tsx')) return true
        return false
    })
    mockFs.readFileSync = vi.fn().mockImplementation((p: unknown) => {
        const fp = String(p)
        if (fp.endsWith('flint-manifest.json')) return manifestJson
        if (fp.endsWith('Button.tsx')) return sourceCode
        throw new Error(`Unexpected readFileSync: ${fp}`)
    })
    mockFs.writeFileSync = vi.fn()
    mockFs.mkdirSync = vi.fn()
}

function setupWithDrafts(manifestJson: string, draftsJson: string) {
    mockFs.existsSync = vi.fn().mockImplementation((p: unknown) => {
        const fp = String(p)
        if (fp.endsWith('flint-manifest.json')) return true
        if (fp.endsWith('enrichment-drafts.json')) return true
        if (fp.endsWith('Button.tsx')) return true
        return false
    })
    mockFs.readFileSync = vi.fn().mockImplementation((p: unknown) => {
        const fp = String(p)
        if (fp.endsWith('flint-manifest.json')) return manifestJson
        if (fp.endsWith('enrichment-drafts.json')) return draftsJson
        if (fp.endsWith('Button.tsx')) return BUTTON_SOURCE
        throw new Error(`Unexpected readFileSync: ${fp}`)
    })
    mockFs.writeFileSync = vi.fn()
    mockFs.mkdirSync = vi.fn()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.resetAllMocks()
})

// 1. flint_enrich_registry returns bare components with source code
describe('flint_enrich_registry — bare components with source', () => {
    it('returns bare components containing sourceCode when file can be read', () => {
        setupManifest(BARE_MANIFEST)

        const result = handleEnrichRegistry({ projectRoot: PROJECT_ROOT })

        expect(result.bareComponents.length).toBeGreaterThan(0)
        const btn = result.bareComponents.find((c) => c.name === 'Button')
        expect(btn).toBeDefined()
        expect(btn!.sourceCode).toBe(BUTTON_SOURCE)
        expect(btn!.importPath).toBe('@/components/ui/Button')
    })
})

// 2. flint_enrich_registry skips enriched components when overwrite=false
describe('flint_enrich_registry — skips enriched when overwrite=false', () => {
    it('omits Button (already enriched) from bareComponents when overwrite is false', () => {
        // Manifest where Button IS enriched, Modal is bare
        setupManifest(ENRICHED_MANIFEST)

        const result = handleEnrichRegistry({
            projectRoot: PROJECT_ROOT,
            overwrite: false,
        })

        const names = result.bareComponents.map((c) => c.name)
        expect(names).not.toContain('Button')
        // Modal is still bare
        expect(names).toContain('Modal')
        expect(result.enrichedCount).toBe(1)
    })
})

// 3. flint_enrich_registry includes enriched when overwrite=true
describe('flint_enrich_registry — includes enriched when overwrite=true', () => {
    it('includes enriched Button when overwrite=true', () => {
        setupManifest(ENRICHED_MANIFEST)

        const result = handleEnrichRegistry({
            projectRoot: PROJECT_ROOT,
            overwrite: true,
        })

        const names = result.bareComponents.map((c) => c.name)
        expect(names).toContain('Button')
        expect(names).toContain('Modal')
    })
})

// 4. flint_enrich_registry filters to single component when componentName provided
describe('flint_enrich_registry — single component filter', () => {
    it('returns only the named component when componentName is specified', () => {
        setupManifest(BARE_MANIFEST)

        const result = handleEnrichRegistry({
            projectRoot: PROJECT_ROOT,
            componentName: 'Button',
        })

        expect(result.bareComponents).toHaveLength(1)
        expect(result.bareComponents[0].name).toBe('Button')
    })
})

// 5. flint_enrich_registry returns instructions string
describe('flint_enrich_registry — instructions string', () => {
    it('includes a non-empty instructions field in every response', () => {
        setupManifest(BARE_MANIFEST)

        const result = handleEnrichRegistry({ projectRoot: PROJECT_ROOT })

        expect(typeof result.instructions).toBe('string')
        expect(result.instructions.length).toBeGreaterThan(50)
        // Should mention flint_approve_enrichment so the host AI knows what to call next
        expect(result.instructions).toContain('flint_approve_enrichment')
    })
})

// 6. flint_enrich_registry handles missing manifest gracefully
describe('flint_enrich_registry — missing manifest', () => {
    it('returns empty result without throwing when flint-manifest.json is absent', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(false)

        const result = handleEnrichRegistry({ projectRoot: PROJECT_ROOT })

        expect(result.bareComponents).toHaveLength(0)
        expect(result.totalComponents).toBe(0)
        expect(result.enrichedCount).toBe(0)
        expect(result.bareCount).toBe(0)
        expect(result.instructions).toBeTruthy()
    })
})

// 7. flint_approve_enrichment merges draft into manifest
describe('flint_approve_enrichment — merges draft into manifest', () => {
    it('writes description and usageExample from draft into flint-manifest.json', () => {
        setupWithDrafts(BARE_MANIFEST, DRAFTS_FILE)

        const result = handleApproveEnrichment({
            projectRoot: PROJECT_ROOT,
            componentName: 'Button',
            action: 'approve',
        })

        expect(result.ok).toBe(true)
        expect(result.componentName).toBe('Button')
        expect(result.action).toBe('approve')

        // writeFileSync should have been called with updated manifest
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('flint-manifest.json'),
            expect.stringContaining('A reusable button component.'),
            'utf-8',
        )
    })
})

// 8. flint_approve_enrichment respects editedFields overrides
describe('flint_approve_enrichment — editedFields override', () => {
    it('uses editedFields description instead of draft description', () => {
        setupWithDrafts(BARE_MANIFEST, DRAFTS_FILE)

        const result = handleApproveEnrichment({
            projectRoot: PROJECT_ROOT,
            componentName: 'Button',
            action: 'approve',
            editedFields: {
                description: 'Overridden description from reviewer.',
            },
        })

        expect(result.ok).toBe(true)

        // The written manifest JSON should contain the overridden description
        const writtenArgs = (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls.find(
            ([fp]: [unknown]) => String(fp).endsWith('flint-manifest.json'),
        )
        expect(writtenArgs).toBeDefined()
        const writtenJson = String(writtenArgs![1])
        expect(writtenJson).toContain('Overridden description from reviewer.')
        // Original draft description should NOT be in the manifest
        expect(writtenJson).not.toContain('A reusable button component.')
    })
})

// 9. flint_approve_enrichment with action=dismiss removes draft
describe('flint_approve_enrichment — dismiss', () => {
    it('removes draft without touching flint-manifest.json', () => {
        setupWithDrafts(BARE_MANIFEST, DRAFTS_FILE)

        const result = handleApproveEnrichment({
            projectRoot: PROJECT_ROOT,
            componentName: 'Button',
            action: 'dismiss',
        })

        expect(result.ok).toBe(true)
        expect(result.action).toBe('dismiss')

        // writeFileSync should NOT have been called for flint-manifest.json
        const manifestWriteCalls = (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls.filter(
            ([fp]: [unknown]) => String(fp).endsWith('flint-manifest.json'),
        )
        expect(manifestWriteCalls).toHaveLength(0)

        // But it SHOULD have been called to update the drafts file
        const draftWriteCalls = (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls.filter(
            ([fp]: [unknown]) => String(fp).endsWith('enrichment-drafts.json'),
        )
        expect(draftWriteCalls.length).toBeGreaterThan(0)
    })
})

// 10. flint_approve_enrichment returns error for nonexistent draft
describe('flint_approve_enrichment — nonexistent draft', () => {
    it('returns ok=false with an error message when no draft exists', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(false)

        const result = handleApproveEnrichment({
            projectRoot: PROJECT_ROOT,
            componentName: 'Nonexistent',
            action: 'approve',
        })

        expect(result.ok).toBe(false)
        expect(result.error).toContain("No pending draft found for component 'Nonexistent'")
    })
})

// 11. saveDraft creates .flint/ directory if needed
describe('saveDraft — creates .flint/ directory', () => {
    it('calls mkdirSync when the .flint directory does not exist', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(false)
        mockFs.mkdirSync = vi.fn()
        mockFs.writeFileSync = vi.fn()
        mockFs.readFileSync = vi.fn().mockImplementation(() => {
            throw new Error('file not found')
        })

        saveDraft(PROJECT_ROOT, 'Button', SAMPLE_DRAFT)

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('.flint'),
            expect.objectContaining({ recursive: true }),
        )
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('enrichment-drafts.json'),
            expect.stringContaining('"description"'),
            'utf-8',
        )
    })
})

// 12. removeDraft returns correct remaining count
describe('removeDraft — returns remaining count', () => {
    it('returns the number of drafts remaining after removal', () => {
        const twoComponentDrafts = JSON.stringify({
            generatedAt: '2026-03-20T00:00:00.000Z',
            generatedBy: 'test-agent',
            drafts: {
                Button: SAMPLE_DRAFT,
                Modal: { ...SAMPLE_DRAFT, description: 'A modal dialog.' },
            },
        })

        mockFs.existsSync = vi.fn().mockReturnValue(true)
        mockFs.readFileSync = vi.fn().mockReturnValue(twoComponentDrafts)
        mockFs.writeFileSync = vi.fn()
        mockFs.mkdirSync = vi.fn()

        const remaining = removeDraft(PROJECT_ROOT, 'Button')

        expect(remaining).toBe(1)

        // Verify the written JSON no longer contains Button
        const writtenJson = String(
            (mockFs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0]![1],
        )
        expect(writtenJson).not.toContain('"Button"')
        expect(writtenJson).toContain('"Modal"')
    })

    it('returns 0 when drafts file does not exist', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(false)

        const remaining = removeDraft(PROJECT_ROOT, 'Ghost')

        expect(remaining).toBe(0)
    })
})

// ── Bonus edge cases ──────────────────────────────────────────────────────────

describe('flint_enrich_registry — malformed manifest JSON', () => {
    it('returns empty result without throwing on malformed JSON', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true)
        mockFs.readFileSync = vi.fn().mockReturnValue('{not valid json')

        const result = handleEnrichRegistry({ projectRoot: PROJECT_ROOT })

        expect(result.bareComponents).toHaveLength(0)
        expect(result.totalComponents).toBe(0)
    })
})

describe('flint_enrich_registry — component with no source file', () => {
    it('returns null sourceCode when source file cannot be resolved', () => {
        // Manifest references a component whose source file does not exist
        const manifestJson = JSON.stringify({
            components: {
                Ghost: {
                    name: 'Ghost',
                    importPath: '@/components/Ghost',
                    props: {},
                },
            },
        })
        mockFs.existsSync = vi.fn().mockImplementation((p: unknown) => {
            const fp = String(p)
            if (fp.endsWith('flint-manifest.json')) return true
            if (fp.endsWith('enrichment-drafts.json')) return false
            return false  // source file not found
        })
        mockFs.readFileSync = vi.fn().mockImplementation((p: unknown) => {
            const fp = String(p)
            if (fp.endsWith('flint-manifest.json')) return manifestJson
            throw new Error(`Not found: ${fp}`)
        })

        const result = handleEnrichRegistry({ projectRoot: PROJECT_ROOT })

        expect(result.bareComponents).toHaveLength(1)
        expect(result.bareComponents[0].sourceCode).toBeNull()
    })
})

describe('flint_enrich_registry — totalComponents and enrichedCount accuracy', () => {
    it('counts all components and enriched correctly', () => {
        // 1 enriched (Button), 1 bare (Modal)
        setupManifest(ENRICHED_MANIFEST)

        const result = handleEnrichRegistry({
            projectRoot: PROJECT_ROOT,
            overwrite: false,
        })

        expect(result.totalComponents).toBe(2)
        expect(result.enrichedCount).toBe(1)
        expect(result.bareCount).toBe(1)  // only Modal returned as bare
    })
})

describe('getDraft — returns null for missing draft', () => {
    it('returns null when no drafts file exists', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(false)

        const draft = getDraft(PROJECT_ROOT, 'Button')

        expect(draft).toBeNull()
    })

    it('returns null when component not in drafts', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true)
        mockFs.readFileSync = vi.fn().mockReturnValue(
            JSON.stringify({
                generatedAt: '2026-03-20T00:00:00.000Z',
                generatedBy: 'test',
                drafts: {},
            }),
        )

        const draft = getDraft(PROJECT_ROOT, 'NotThere')

        expect(draft).toBeNull()
    })
})

describe('readDrafts — handles corrupt JSON', () => {
    it('returns null when drafts file contains invalid JSON', () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true)
        mockFs.readFileSync = vi.fn().mockReturnValue('{corrupt')

        const result = readDrafts(PROJECT_ROOT)

        expect(result).toBeNull()
    })
})
