// ---------------------------------------------------------------------------
// Design System Context Builder — flint-mcp/src/core/designSystemContext.ts
// ---------------------------------------------------------------------------
// Builds a rich context string from design system search results (e.g., from
// Figma MCP search_design_system) for injection into AI refinement prompts.
// Pure functions, no I/O, no side effects.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Type contracts
// ---------------------------------------------------------------------------

export interface DesignSystemDoc {
    componentName: string
    description?: string
    usage?: string
    dosDonts?: Array<{ type: 'do' | 'dont'; text: string }>
    props?: Array<{ name: string; type: string; required: boolean; default?: string }>
    examples?: string[]
    relatedComponents?: string[]
}

// ---------------------------------------------------------------------------
// buildDesignSystemContext
// ---------------------------------------------------------------------------

/**
 * Build a markdown-formatted context string from design system documentation.
 * This gets injected into the AI refinement prompt to improve output quality.
 *
 * Returns an empty string when docs is empty or contains no valid entries.
 * The output is kept under a reasonable prompt budget (~2000 tokens).
 */
export function buildDesignSystemContext(docs: DesignSystemDoc[]): string {
    if (!docs || docs.length === 0) {
        return ''
    }

    const sections: string[] = []

    for (const doc of docs) {
        if (!doc.componentName || typeof doc.componentName !== 'string') {
            continue
        }

        const lines: string[] = []
        lines.push(`## Component: ${doc.componentName}`)

        if (doc.description) {
            lines.push(`Description: ${doc.description}`)
        }

        if (doc.usage) {
            lines.push(`Usage: ${doc.usage}`)
        }

        // Props table
        if (doc.props && doc.props.length > 0) {
            const propsStr = doc.props
                .map(p => {
                    const parts = [p.name]
                    if (p.type) parts.push(`(${p.type})`)
                    if (p.required) parts.push('[required]')
                    if (p.default !== undefined && p.default !== '') {
                        parts.push(`default: ${p.default}`)
                    }
                    return parts.join(' ')
                })
                .join(', ')
            lines.push(`Props: ${propsStr}`)
        }

        // Do/Don't guidelines
        if (doc.dosDonts && doc.dosDonts.length > 0) {
            for (const item of doc.dosDonts) {
                if (item.type === 'do') {
                    lines.push(`Do: ${item.text}`)
                } else if (item.type === 'dont') {
                    lines.push(`Don't: ${item.text}`)
                }
            }
        }

        // Examples (truncated to keep prompt budget reasonable)
        if (doc.examples && doc.examples.length > 0) {
            const maxExamples = 2
            const shown = doc.examples.slice(0, maxExamples)
            for (const ex of shown) {
                lines.push(`Example: ${ex}`)
            }
        }

        // Related components
        if (doc.relatedComponents && doc.relatedComponents.length > 0) {
            lines.push(`Related: ${doc.relatedComponents.join(', ')}`)
        }

        sections.push(lines.join('\n'))
    }

    if (sections.length === 0) {
        return ''
    }

    return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// parseDesignSystemResponse
// ---------------------------------------------------------------------------

/**
 * Parse the raw response from Figma MCP search_design_system into structured docs.
 *
 * Handles multiple input formats:
 *   1. JSON array of DesignSystemDoc objects
 *   2. JSON object with a `results` or `components` array
 *   3. Newline-delimited JSON (one object per line)
 *
 * Invalid entries are silently skipped. Returns an empty array on total failure.
 */
export function parseDesignSystemResponse(rawResponse: string): DesignSystemDoc[] {
    if (!rawResponse || typeof rawResponse !== 'string' || rawResponse.trim().length === 0) {
        return []
    }

    const trimmed = rawResponse.trim()

    // Try parsing as JSON first
    try {
        const parsed = JSON.parse(trimmed)

        // Case 1: Direct array
        if (Array.isArray(parsed)) {
            return parsed.filter(isValidDoc).map(normalizeDoc)
        }

        // Case 2: Wrapper object with results/components key
        if (parsed && typeof parsed === 'object') {
            const candidates = parsed.results ?? parsed.components ?? parsed.data
            if (Array.isArray(candidates)) {
                return candidates.filter(isValidDoc).map(normalizeDoc)
            }

            // Case 2b: Single doc object
            if (isValidDoc(parsed)) {
                return [normalizeDoc(parsed)]
            }
        }

        return []
    } catch {
        // Case 3: Try newline-delimited JSON
        const lines = trimmed.split('\n').filter(l => l.trim().length > 0)
        const docs: DesignSystemDoc[] = []

        for (const line of lines) {
            try {
                const obj = JSON.parse(line.trim())
                if (isValidDoc(obj)) {
                    docs.push(normalizeDoc(obj))
                }
            } catch {
                // Skip unparseable lines
            }
        }

        return docs
    }
}

// ---------------------------------------------------------------------------
// filterDocsForComponent
// ---------------------------------------------------------------------------

/**
 * Filter design system docs to find entries relevant to a given component name.
 * Uses case-insensitive substring matching to find related documentation.
 *
 * Example: component "ContactFormButton" matches docs for "Button".
 */
export function filterDocsForComponent(
    docs: DesignSystemDoc[],
    componentName: string,
): DesignSystemDoc[] {
    if (!docs || docs.length === 0 || !componentName) {
        return []
    }

    const lowerName = componentName.toLowerCase()

    return docs.filter(doc => {
        const docName = doc.componentName.toLowerCase()
        // Match if the doc component name appears in the target component name
        // or the target component name appears in the doc component name
        return lowerName.includes(docName) || docName.includes(lowerName)
    })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isValidDoc(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false
    const candidate = obj as Record<string, unknown>
    // Must have componentName (or name as fallback)
    return (
        (typeof candidate.componentName === 'string' && candidate.componentName.trim().length > 0) ||
        (typeof candidate.name === 'string' && candidate.name.trim().length > 0)
    )
}

function normalizeDoc(obj: Record<string, unknown>): DesignSystemDoc {
    const name = (typeof obj.componentName === 'string' ? obj.componentName : obj.name) as string

    const doc: DesignSystemDoc = {
        componentName: name.trim(),
    }

    if (typeof obj.description === 'string' && obj.description.trim()) {
        doc.description = obj.description.trim()
    }

    if (typeof obj.usage === 'string' && obj.usage.trim()) {
        doc.usage = obj.usage.trim()
    }

    if (Array.isArray(obj.dosDonts)) {
        doc.dosDonts = obj.dosDonts.filter(
            (d: unknown) =>
                d &&
                typeof d === 'object' &&
                ('type' in (d as object)) &&
                ('text' in (d as object)) &&
                ((d as { type: string }).type === 'do' || (d as { type: string }).type === 'dont') &&
                typeof (d as { text: unknown }).text === 'string',
        ) as Array<{ type: 'do' | 'dont'; text: string }>
    }

    if (Array.isArray(obj.props)) {
        doc.props = obj.props
            .filter(
                (p: unknown) =>
                    p &&
                    typeof p === 'object' &&
                    typeof (p as { name: unknown }).name === 'string',
            )
            .map((p: unknown) => {
                const prop = p as Record<string, unknown>
                return {
                    name: prop.name as string,
                    type: (typeof prop.type === 'string' ? prop.type : 'unknown') as string,
                    required: prop.required === true,
                    ...(typeof prop.default === 'string' && prop.default !== ''
                        ? { default: prop.default }
                        : {}),
                }
            })
    }

    if (Array.isArray(obj.examples)) {
        doc.examples = obj.examples.filter(
            (e: unknown) => typeof e === 'string' && e.trim().length > 0,
        ) as string[]
    }

    if (Array.isArray(obj.relatedComponents)) {
        doc.relatedComponents = obj.relatedComponents.filter(
            (r: unknown) => typeof r === 'string' && r.trim().length > 0,
        ) as string[]
    }

    return doc
}
