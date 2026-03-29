/**
 * flint_enrich_registry + flint_approve_enrichment tool handlers — EN.1
 *
 * These two tools power the registry enrichment pipeline:
 *
 *   flint_enrich_registry  — reads bare components and returns structured
 *                             data so the host AI can generate descriptions,
 *                             usage examples, and a11y notes.
 *
 *   flint_approve_enrichment — moves an approved draft from the staging
 *                               file (.flint/enrichment-drafts.json) into
 *                               the canonical flint-manifest.json.
 *
 * Neither tool generates AI content itself.  flint_enrich_registry is a
 * data-gathering pass; the host model does the generation; flint_approve_
 * enrichment is the write-back gate.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ComponentEntry } from '../core/registryService.js'
import {
    readDrafts,
    removeDraft,
    getDraft,
} from '../core/enrichmentDraftService.js'
import type { EnrichmentDraft } from '../core/enrichmentDraftService.js'

// ── Tool definition constants (for ListToolsRequestSchema) ───────────────────

export const FLINT_ENRICH_REGISTRY_TOOL = {
    name: 'flint_enrich_registry',
    description:
        'Read bare component registry entries so the host AI can generate enrichments. ' +
        'Returns source code, props, variants, and tokens for components lacking description ' +
        'or usageExample. Call this tool, generate enrichments, then call flint_approve_enrichment.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root (must contain flint-manifest.json).',
            },
            componentName: {
                type: 'string',
                description: 'Optional: enrich a single named component. Omit to get all bare components.',
            },
            overwrite: {
                type: 'boolean',
                description:
                    'When false (default), skips components that already have both description and usageExample. ' +
                    'Set true to include already-enriched components.',
            },
        },
        required: ['projectRoot'],
    },
} as const

export const FLINT_APPROVE_ENRICHMENT_TOOL = {
    name: 'flint_approve_enrichment',
    description:
        'Approve or dismiss a staged enrichment draft for a component. ' +
        "When action='approve', merges the draft into flint-manifest.json. " +
        "When action='dismiss', removes the draft from staging. " +
        'Optionally accepts editedFields to override specific draft values before approval.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root.',
            },
            componentName: {
                type: 'string',
                description: 'The component name whose draft should be approved or dismissed.',
            },
            action: {
                type: 'string',
                enum: ['approve', 'dismiss'],
                description: "'approve' — merge draft into manifest. 'dismiss' — remove draft without applying.",
            },
            editedFields: {
                type: 'object',
                description: 'Optional field overrides applied on top of the draft before merging.',
                properties: {
                    description: { type: 'string' },
                    usageExample: { type: 'string' },
                    compositionNotes: { type: 'string' },
                    a11yNotes: { type: 'string' },
                    relatedComponents: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            },
        },
        required: ['projectRoot', 'componentName', 'action'],
    },
} as const

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichArgs {
    projectRoot: string
    componentName?: string
    overwrite?: boolean
}

export interface BareComponentInfo {
    name: string
    props: ComponentEntry['props']
    variants: ComponentEntry['variants']
    tokens: ComponentEntry['tokens']
    sourceCode: string | null
    importPath: string
}

export interface EnrichRegistryResult {
    bareComponents: BareComponentInfo[]
    totalComponents: number
    enrichedCount: number
    bareCount: number
    instructions: string
}

export interface ApproveArgs {
    projectRoot: string
    componentName: string
    action: 'approve' | 'dismiss'
    editedFields?: {
        description?: string
        usageExample?: string
        compositionNotes?: string
        a11yNotes?: string
        relatedComponents?: string[]
    }
}

export interface ApproveResult {
    ok: boolean
    componentName: string
    action: 'approve' | 'dismiss'
    remainingDrafts: number
    error?: string
}

// ── Source file resolver ──────────────────────────────────────────────────────

const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

/**
 * Try common extensions to find the source file for an importPath.
 * Returns the content string or null when not found.
 */
function resolveSourceCode(projectRoot: string, importPath: string): string | null {
    // importPath may be an @-alias like "@/components/ui/Button" or a relative
    // path.  Normalise to a candidate filesystem path by stripping leading @/.
    let base = importPath
        .replace(/^@\//, 'src/')       // "@/components" → "src/components"
        .replace(/^@components\//, 'src/components/')  // rare alias pattern

    // If still looks like a package (no slash beyond the first char) skip.
    if (!base.includes('/')) return null

    for (const ext of SOURCE_EXTENSIONS) {
        const candidate = path.join(projectRoot, `${base}${ext}`)
        if (fs.existsSync(candidate)) {
            try {
                return fs.readFileSync(candidate, 'utf-8')
            } catch {
                return null
            }
        }
        // Also try without extension (e.g., the importPath already has it)
        const candidateDirect = path.join(projectRoot, base)
        if (fs.existsSync(candidateDirect)) {
            try {
                return fs.readFileSync(candidateDirect, 'utf-8')
            } catch {
                return null
            }
        }
    }

    return null
}

// ── Enrichment instructions string ────────────────────────────────────────────

const ENRICHMENT_INSTRUCTIONS = `You are enriching a Flint component registry.

For each component in bareComponents, generate the following fields and call
flint_approve_enrichment for each one:

  description       — 1-3 sentences describing what the component does,
                      its primary use case, and key behaviours. Plain prose.

  usageExample      — A self-contained TSX snippet (no imports) showing the
                      most common usage pattern. Keep it under 20 lines.

  compositionNotes  — (optional) Patterns for combining this component with
                      others: do's, don'ts, slot composition, layout guidance.

  a11yNotes         — (optional) Accessibility notes beyond WCAG rules:
                      focus management, keyboard interaction, ARIA patterns.

  relatedComponents — (optional) Array of string component names that are
                      commonly used alongside this one.

  confidence        — "high" | "medium" | "low" — your confidence in the
                      generated enrichment based on sourceCode clarity.

Call flint_approve_enrichment with action='approve' to write each enrichment
into flint-manifest.json, or action='dismiss' to skip a component.`

// ── Handler: flint_enrich_registry ─────────────────────────────────────────

export function handleEnrichRegistry(args: EnrichArgs): EnrichRegistryResult {
    const { projectRoot, componentName, overwrite = false } = args

    // Read manifest
    const manifestPath = path.join(projectRoot, 'flint-manifest.json')
    if (!fs.existsSync(manifestPath)) {
        return {
            bareComponents: [],
            totalComponents: 0,
            enrichedCount: 0,
            bareCount: 0,
            instructions: ENRICHMENT_INSTRUCTIONS,
        }
    }

    let manifest: { components?: Record<string, ComponentEntry> }
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    } catch {
        return {
            bareComponents: [],
            totalComponents: 0,
            enrichedCount: 0,
            bareCount: 0,
            instructions: ENRICHMENT_INSTRUCTIONS,
        }
    }

    const components = manifest.components ?? {}

    // Read pending drafts so we can mark components as "draft"
    const draftsFile = readDrafts(projectRoot)
    const pendingDraftNames = new Set(
        draftsFile ? Object.keys(draftsFile.drafts) : [],
    )

    // Determine which components to process
    let entries = Object.entries(components)
    if (componentName) {
        entries = entries.filter(([name]) => name === componentName)
    }

    const totalComponents = Object.keys(components).length
    let enrichedCount = 0
    const bareComponents: BareComponentInfo[] = []

    for (const [name, entry] of entries) {
        const isEnriched =
            typeof entry.description === 'string' &&
            entry.description.trim().length > 0 &&
            typeof entry.usageExample === 'string' &&
            entry.usageExample.trim().length > 0

        if (isEnriched) {
            enrichedCount++
            if (!overwrite) {
                // skip — already enriched and caller did not request overwrite
                continue
            }
        }

        // Determine enrichment state: 'draft' or 'bare'
        const _state: 'enriched' | 'draft' | 'bare' = isEnriched
            ? 'enriched'
            : pendingDraftNames.has(name)
            ? 'draft'
            : 'bare'

        const sourceCode = resolveSourceCode(projectRoot, entry.importPath)

        bareComponents.push({
            name,
            props: entry.props,
            variants: entry.variants,
            tokens: entry.tokens,
            sourceCode,
            importPath: entry.importPath,
        })
    }

    const bareCount = bareComponents.length

    return {
        bareComponents,
        totalComponents,
        enrichedCount,
        bareCount,
        instructions: ENRICHMENT_INSTRUCTIONS,
    }
}

// ── Handler: flint_approve_enrichment ───────────────────────────────────────

export function handleApproveEnrichment(args: ApproveArgs): ApproveResult {
    const { projectRoot, componentName, action, editedFields } = args

    // Locate the draft
    const draft = getDraft(projectRoot, componentName)
    if (!draft) {
        return {
            ok: false,
            componentName,
            action,
            remainingDrafts: 0,
            error: `No pending draft found for component '${componentName}'. Call flint_enrich_registry first.`,
        }
    }

    if (action === 'dismiss') {
        const remaining = removeDraft(projectRoot, componentName)
        return { ok: true, componentName, action, remainingDrafts: remaining }
    }

    // action === 'approve'
    const manifestPath = path.join(projectRoot, 'flint-manifest.json')
    if (!fs.existsSync(manifestPath)) {
        return {
            ok: false,
            componentName,
            action,
            remainingDrafts: 0,
            error: `flint-manifest.json not found at ${manifestPath}.`,
        }
    }

    let manifest: { components?: Record<string, ComponentEntry> }
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    } catch (err) {
        return {
            ok: false,
            componentName,
            action,
            remainingDrafts: 0,
            error: `Failed to parse flint-manifest.json: ${err instanceof Error ? err.message : String(err)}`,
        }
    }

    if (!manifest.components) {
        manifest.components = {}
    }

    // Merge draft fields into the manifest entry.
    // editedFields take precedence over the raw draft fields.
    const effective: Partial<EnrichmentDraft> = { ...draft, ...editedFields }

    const existing: ComponentEntry = manifest.components[componentName] ?? {
        name: componentName,
        importPath: '',
    }

    const updated: ComponentEntry = {
        ...existing,
        description: effective.description ?? existing.description,
        usageExample: effective.usageExample ?? existing.usageExample,
        compositionNotes:
            effective.compositionNotes ?? existing.compositionNotes,
        a11yNotes: effective.a11yNotes ?? existing.a11yNotes,
        relatedComponents:
            effective.relatedComponents ?? existing.relatedComponents,
    }

    manifest.components[componentName] = updated

    try {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    } catch (err) {
        return {
            ok: false,
            componentName,
            action,
            remainingDrafts: 0,
            error: `Failed to write flint-manifest.json: ${err instanceof Error ? err.message : String(err)}`,
        }
    }

    // Remove the draft now that it has been merged
    const remaining = removeDraft(projectRoot, componentName)

    return { ok: true, componentName, action, remainingDrafts: remaining }
}
