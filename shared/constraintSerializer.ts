/**
 * shared/constraintSerializer.ts
 *
 * Pure serialization functions for CR.1-3 constraint injection into AI system prompts.
 * These functions take data and return markdown strings — no Node.js, Electron, or
 * filesystem dependencies. Both the Electron orchestrator and the web server's AI
 * chat service can use these.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Minimal token shape required for serialization.
 * Compatible with the SQLite MithrilToken rows (Electron) and the W3C DTCG
 * JSON format after normalization (web).
 */
export interface ConstraintToken {
  token_path: string
  token_type: string
  token_value: string
}

/** Minimal prop definition for registry entries. */
export interface ConstraintPropDef {
  type: string
  required: boolean
  default?: string
}

/** Minimal registry entry shape for serialization. */
export interface ConstraintRegistryEntry {
  name: string
  props?: Record<string, ConstraintPropDef>
  variants?: string[]
  tokens?: string[]
  importPath?: string
  description?: string
}

// ── Serialization Functions ────────────────────────────────────────────────────

/**
 * CR.1 — Serialize the component registry into a BINDING markdown constraint block.
 *
 * The block instructs the model to use only registered components. Empty registry
 * returns an empty string (backward compatible — no constraint on token-less projects).
 *
 * @param registry  The (optionally scope-filtered) registry map.
 * @param scope     Optional allow-list of component names. When non-empty, only
 *                  entries whose key appears in scope are included.
 */
export function serializeRegistryConstraints(
  registry: Record<string, ConstraintRegistryEntry>,
  scope?: string[],
): string {
  if (!registry || Object.keys(registry).length === 0) return ''

  // Apply scope filter when provided and non-empty
  let entries = Object.entries(registry)
  if (scope && scope.length > 0) {
    const scopeSet = new Set(scope)
    entries = entries.filter(([key]) => scopeSet.has(key))
  }

  if (entries.length === 0) return ''

  const MAX_COMPONENTS = 40
  const total = entries.length
  const truncated = entries.length > MAX_COMPONENTS
  const slice = truncated ? entries.slice(0, MAX_COMPONENTS) : entries

  const lines: string[] = [
    '## Project Component Registry (BINDING)',
    '',
    'You MUST only compose UI from components in this registry. Do NOT reference, create, or import components not listed here. If the user\'s request cannot be fulfilled with these components, explain what\'s missing.',
    '',
    'Available components:',
  ]

  for (const [key, entry] of slice) {
    const name = entry.name ?? key
    const parts: string[] = []

    // Props — mark required ones with [required]
    if (entry.props && Object.keys(entry.props).length > 0) {
      const propList = Object.entries(entry.props)
        .map(([pName, pDef]) => pDef.required ? `${pName}[required]` : pName)
        .join(', ')
      parts.push(`props: ${propList}`)
    }

    // Variants
    if (entry.variants && entry.variants.length > 0) {
      parts.push(`variants: ${entry.variants.join(', ')}`)
    }

    // Consumed tokens
    if (entry.tokens && entry.tokens.length > 0) {
      parts.push(`tokens: ${entry.tokens.join(', ')}`)
    }

    const detail = parts.length > 0 ? ` (${parts.join(') (')})` : ''
    lines.push(`- ${name}${detail}`)
  }

  if (truncated) {
    lines.push(`\n${MAX_COMPONENTS} of ${total} components shown. Use flint_search_design_system for the full catalog.`)
  }

  return lines.join('\n')
}

/**
 * CR.1 — Serialize the design token palette into a BINDING markdown constraint block.
 *
 * Tokens are grouped by token_type. Empty token array returns an empty string.
 *
 * @param tokens  Array of tokens with token_path, token_type, and token_value.
 */
export function serializeTokenConstraints(tokens: ConstraintToken[]): string {
  if (!tokens || tokens.length === 0) return ''

  // Group by token_type
  const groups: Record<string, ConstraintToken[]> = {}
  for (const token of tokens) {
    const type = token.token_type ?? 'other'
    if (!groups[type]) groups[type] = []
    groups[type].push(token)
  }

  const lines: string[] = [
    '## Design Token Palette (BINDING)',
    '',
    'All visual properties MUST use these tokens. Do NOT use arbitrary hex colors, pixel values, or spacing values not in this list.',
    '',
  ]

  // Irregular/uncountable token type labels
  const TOKEN_TYPE_LABELS: Record<string, string> = {
    color: 'Colors',
    typography: 'Typography',
    spacing: 'Spacing',
    shadow: 'Shadows',
    opacity: 'Opacity',
    radius: 'Radius',
    other: 'Other',
  }

  for (const [type, group] of Object.entries(groups)) {
    // Capitalize type name; use lookup table for irregular forms
    const label = TOKEN_TYPE_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1) + 's')
    // Format: "Type: token-path (value), token-path (value)"
    const tokenEntries = group
      .map(t => `${t.token_path} (${t.token_value})`)
      .join(', ')
    lines.push(`${label}: ${tokenEntries}`)
  }

  return lines.join('\n')
}

/**
 * LIB.1 — Serialize a library idiom block for the system prompt.
 *
 * This is a simple passthrough: the caller is responsible for loading the
 * idiom block string from the adapter registry. This function just validates
 * and returns it, providing a consistent interface.
 *
 * @param idiomBlock  The pre-loaded idiom block string, or undefined/empty.
 */
export function serializeLibraryIdiomBlock(idiomBlock: string | undefined): string {
  if (!idiomBlock) return ''
  return idiomBlock
}

// ── DTCG Normalization ─────────────────────────────────────────────────────────

/**
 * Normalize W3C DTCG JSON tokens into the flat ConstraintToken[] shape.
 *
 * DTCG tokens are nested objects where leaf nodes have `$value` and `$type`.
 * This function walks the tree and produces flat rows compatible with the
 * serialization functions above.
 *
 * @param dtcgJson  The parsed design-tokens.json object.
 * @returns         Flat array of ConstraintToken objects.
 */
export function normalizeDTCGTokens(dtcgJson: unknown): ConstraintToken[] {
  if (!dtcgJson || typeof dtcgJson !== 'object') return []

  const tokens: ConstraintToken[] = []

  function walk(node: Record<string, unknown>, pathParts: string[]): void {
    // Leaf node — has $value
    if (node.$value !== undefined) {
      const tokenValue = typeof node.$value === 'string'
        ? node.$value
        : JSON.stringify(node.$value)
      const tokenType = typeof node.$type === 'string'
        ? node.$type
        : 'other'
      tokens.push({
        token_path: pathParts.join('.'),
        token_type: tokenType,
        token_value: tokenValue,
      })
      return
    }

    // Branch node — recurse into children (skip $ keys)
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, [...pathParts, key])
      }
    }
  }

  walk(dtcgJson as Record<string, unknown>, [])
  return tokens
}
