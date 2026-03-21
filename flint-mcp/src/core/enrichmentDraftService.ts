/**
 * enrichmentDraftService — flint-mcp/src/core/enrichmentDraftService.ts
 *
 * Draft storage helpers for the registry enrichment pipeline (EN.1).
 *
 * Drafts are staged in <projectRoot>/.flint/enrichment-drafts.json before
 * the host AI's generated descriptions are approved and merged into the
 * canonical flint-manifest.json by flint_approve_enrichment.
 */

import fs from 'node:fs'
import path from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichmentDraft {
    description: string
    usageExample: string
    compositionNotes?: string
    a11yNotes?: string
    relatedComponents?: string[]
    confidence: 'high' | 'medium' | 'low'
    usageFileCount: number
    sourceFile: string
    generatedAt: string
    generatedBy: string
}

export interface EnrichmentDraftsFile {
    generatedAt: string
    generatedBy: string
    drafts: Record<string, EnrichmentDraft>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function draftsPath(projectRoot: string): string {
    return path.join(projectRoot, '.flint', 'enrichment-drafts.json')
}

function ensureFlintDir(projectRoot: string): void {
    const dir = path.join(projectRoot, '.flint')
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read the drafts file.  Returns null when the file does not exist.
 */
export function readDrafts(projectRoot: string): EnrichmentDraftsFile | null {
    const p = draftsPath(projectRoot)
    if (!fs.existsSync(p)) return null
    try {
        const raw = fs.readFileSync(p, 'utf-8')
        return JSON.parse(raw) as EnrichmentDraftsFile
    } catch {
        return null
    }
}

/**
 * Overwrite the entire drafts file with the supplied data.
 */
export function writeDrafts(projectRoot: string, data: EnrichmentDraftsFile): void {
    ensureFlintDir(projectRoot)
    fs.writeFileSync(draftsPath(projectRoot), JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Upsert a single draft.  Creates the file if it does not yet exist.
 */
export function saveDraft(
    projectRoot: string,
    componentName: string,
    draft: EnrichmentDraft,
): void {
    ensureFlintDir(projectRoot)
    const existing = readDrafts(projectRoot)
    const file: EnrichmentDraftsFile = existing ?? {
        generatedAt: new Date().toISOString(),
        generatedBy: 'flint_enrich_registry',
        drafts: {},
    }
    file.drafts[componentName] = draft
    writeDrafts(projectRoot, file)
}

/**
 * Remove a single draft by component name.
 * Returns the number of remaining drafts after removal.
 */
export function removeDraft(projectRoot: string, componentName: string): number {
    const existing = readDrafts(projectRoot)
    if (!existing) return 0
    delete existing.drafts[componentName]
    writeDrafts(projectRoot, existing)
    return Object.keys(existing.drafts).length
}

/**
 * Retrieve a single draft.  Returns null when no draft exists for the name.
 */
export function getDraft(
    projectRoot: string,
    componentName: string,
): EnrichmentDraft | null {
    const file = readDrafts(projectRoot)
    if (!file) return null
    return file.drafts[componentName] ?? null
}
