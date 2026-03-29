/**
 * ragStore.ts — server/services/ragStore.ts
 *
 * sqlite-vec powered RAG store for design system context injection.
 *
 * Mirrors the Electron implementation (electron/ragService.ts + electron/ragSeeder.ts)
 * but uses a lightweight character n-gram hashing approach for embeddings instead of
 * the HuggingFace transformer pipeline (which requires ONNX runtime / GPU support
 * that is not available in a headless Node web server context).
 *
 * The embedding strategy:
 *   1. Tokenize text into character n-grams (tri-grams and quad-grams)
 *   2. Hash each n-gram to a bucket in a fixed-size vector (384 dimensions,
 *      matching the vec_design_system schema from electron/store.ts)
 *   3. L2-normalize the resulting vector
 *
 * This gives approximate semantic matching — texts sharing similar substrings
 * will cluster together. Not as powerful as a neural model, but entirely offline,
 * zero-dependency, and deterministic.
 */

import type Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { readFile, readdir, lstat } from 'node:fs/promises'
import path from 'node:path'

// ── Constants ────────────────────────────────────────────────────────────────

/** Embedding dimensionality — must match the vec0 table definition (float[384]). */
const EMBED_DIM = 384

const BRAND = {
  logPrefix: '[Flint RAG]',
  configDir: '.flint',
  manifestFile: 'flint-manifest.json',
} as const

// ── Types ────────────────────────────────────────────────────────────────────

export interface RAGResult {
  id: number
  content: string
  source: string
  chunkType: string
  distance: number
}

export interface RAGService {
  query(queryText: string, limit?: number): Promise<RAGResult[]>
  ingest(chunks: Array<{ content: string; source?: string; chunkType?: string }>): Promise<{ ingested: number }>
  clear(): Promise<void>
  count(): Promise<number>
  seedFromProject(projectRoot: string): Promise<{ ingested: number; sources: string[] }>
}

// ── Embedding: character n-gram hashing ──────────────────────────────────────

/**
 * FNV-1a 32-bit hash for a string. Fast, low-collision for short inputs.
 */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash
}

/**
 * Generate a fixed-dimension float32 embedding from text using character n-gram
 * hashing. Produces a 384-dimensional vector that is L2-normalized.
 *
 * The approach:
 *   1. Lowercase and trim the text
 *   2. Extract all tri-grams and quad-grams
 *   3. Hash each n-gram to a bucket index (0..EMBED_DIM-1)
 *   4. Increment that bucket (TF-IDF-like term frequency)
 *   5. L2-normalize the vector so cosine distance works correctly with sqlite-vec
 */
function embedText(text: string): Float32Array {
  const vec = new Float32Array(EMBED_DIM)
  const normalized = text.toLowerCase().trim()

  if (normalized.length === 0) {
    return vec
  }

  // Tri-grams
  for (let i = 0; i <= normalized.length - 3; i++) {
    const gram = normalized.substring(i, i + 3)
    const bucket = fnv1a(gram) % EMBED_DIM
    vec[bucket] += 1.0
  }

  // Quad-grams (gives more specificity for longer shared phrases)
  for (let i = 0; i <= normalized.length - 4; i++) {
    const gram = normalized.substring(i, i + 4)
    const bucket = fnv1a('4:' + gram) % EMBED_DIM
    vec[bucket] += 0.5
  }

  // Word-level unigrams (boosts exact word matches)
  const words = normalized.split(/\s+/).filter(w => w.length > 2)
  for (const word of words) {
    const bucket = fnv1a('w:' + word) % EMBED_DIM
    vec[bucket] += 2.0
  }

  // L2 normalize
  let magnitude = 0
  for (let i = 0; i < EMBED_DIM; i++) {
    magnitude += vec[i] * vec[i]
  }
  magnitude = Math.sqrt(magnitude)

  if (magnitude > 0) {
    for (let i = 0; i < EMBED_DIM; i++) {
      vec[i] /= magnitude
    }
  }

  return vec
}

// ── Seeder types ─────────────────────────────────────────────────────────────

interface PropDef {
  type: string
  required: boolean
  default?: string
}

interface ComponentEntry {
  name: string
  importPath?: string
  description?: string
  props?: Record<string, PropDef>
  variants?: string[]
  tokens?: string[]
  usageExample?: string
  compositionNotes?: string
  a11yNotes?: string
  relatedComponents?: string[]
}

interface FlintManifest {
  components?: Record<string, ComponentEntry>
}

interface DesignToken {
  token_path: string
  token_type: string
  token_value: string
}

interface IngestPayload {
  content: string
  source?: string
  chunkType?: string
}

// ── Seeder formatters ────────────────────────────────────────────────────────

/**
 * Produce a markdown documentation chunk for a single component entry.
 * Mirrors the formatter in electron/ragSeeder.ts.
 */
function formatComponentChunk(entry: ComponentEntry): string {
  const lines: string[] = []

  lines.push(`## Component: ${entry.name}`)
  lines.push('')

  if (entry.description) {
    lines.push(entry.description)
    lines.push('')
  }

  if (entry.importPath) {
    lines.push(`**Import:** \`import { ${entry.name} } from '${entry.importPath}'\``)
    lines.push('')
  }

  if (entry.props && Object.keys(entry.props).length > 0) {
    lines.push('**Props:**')
    lines.push('')
    lines.push('| Prop | Type | Required |')
    lines.push('|------|------|----------|')
    for (const [propName, def] of Object.entries(entry.props)) {
      const req = def.required ? 'yes' : 'no'
      const defVal = def.default ? ` (default: ${def.default})` : ''
      lines.push(`| ${propName} | ${def.type}${defVal} | ${req} |`)
    }
    lines.push('')
  }

  if (entry.variants && entry.variants.length > 0) {
    lines.push(`**Variants:** ${entry.variants.join(', ')}`)
    lines.push('')
  }

  if (entry.tokens && entry.tokens.length > 0) {
    lines.push(`**Design tokens:** ${entry.tokens.join(', ')}`)
    lines.push('')
  }

  if (entry.usageExample) {
    lines.push('**Usage example:**')
    lines.push('```tsx')
    lines.push(entry.usageExample)
    lines.push('```')
    lines.push('')
  }

  if (entry.compositionNotes) {
    lines.push(`**Composition notes:** ${entry.compositionNotes}`)
    lines.push('')
  }

  if (entry.a11yNotes) {
    lines.push(`**Accessibility notes:** ${entry.a11yNotes}`)
    lines.push('')
  }

  if (entry.relatedComponents && entry.relatedComponents.length > 0) {
    lines.push(`**Related components:** ${entry.relatedComponents.join(', ')}`)
    lines.push('')
  }

  return lines.join('\n').trim()
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a RAG service backed by sqlite-vec for a given database connection.
 *
 * Loads the sqlite-vec extension, creates the vec_design_system virtual table
 * if it does not already exist, and returns a service object with query, ingest,
 * clear, count, and seedFromProject methods.
 *
 * The caller is responsible for ensuring the `rag_chunks` metadata table already
 * exists in the database (the web server's initProjectDatabase creates it).
 */
export function createRAGService(db: Database.Database): RAGService {
  // ── Load sqlite-vec extension ────────────────────────────────────────────
  sqliteVec.load(db)
  console.log(`${BRAND.logPrefix} sqlite-vec extension loaded`)

  // ── Ensure the vector virtual table exists ───────────────────────────────
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_design_system USING vec0(
      chunk_id INTEGER PRIMARY KEY,
      embedding float[${EMBED_DIM}]
    )
  `)

  // ── Add embedding column to rag_chunks if missing ────────────────────────
  // The server's initProjectDatabase creates rag_chunks without an embedding
  // column (it was originally metadata-only). We add it here for completeness,
  // though the actual vector data lives in the vec0 virtual table.
  const columns = db.prepare('PRAGMA table_info(rag_chunks)').all() as Array<{ name: string }>
  const hasEmbedding = columns.some(c => c.name === 'embedding')
  if (!hasEmbedding) {
    db.exec('ALTER TABLE rag_chunks ADD COLUMN embedding BLOB')
  }

  // ── Prepared statements ──────────────────────────────────────────────────

  const insertChunkStmt = db.prepare(`
    INSERT INTO rag_chunks (content, source, chunk_type, embedding)
    VALUES (?, ?, ?, ?)
  `)

  const insertVecStmt = db.prepare(`
    INSERT INTO vec_design_system (chunk_id, embedding) VALUES (?, ?)
  `)

  const searchStmt = db.prepare(`
    SELECT
      v.chunk_id,
      v.distance,
      r.content,
      r.source,
      r.chunk_type
    FROM vec_design_system v
    JOIN rag_chunks r ON r.id = v.chunk_id
    WHERE v.embedding MATCH ? AND k = ?
    ORDER BY v.distance
  `)

  const deleteVecStmt = db.prepare('DELETE FROM vec_design_system WHERE chunk_id = ?')
  const deleteChunkStmt = db.prepare('DELETE FROM rag_chunks WHERE id = ?')
  const allChunkIdsStmt = db.prepare('SELECT id FROM rag_chunks')
  const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks')

  // ── Service methods ──────────────────────────────────────────────────────

  async function query(queryText: string, limit = 5): Promise<RAGResult[]> {
    // Guard: if no chunks exist, skip the query (sqlite-vec throws on empty tables)
    const currentCount = (countStmt.get() as { cnt: number }).cnt
    if (currentCount === 0) return []

    const queryVec = embedText(queryText)
    const vecBuffer = Buffer.from(queryVec.buffer)

    try {
      const rows = searchStmt.all(vecBuffer, limit) as Array<{
        chunk_id: number
        distance: number
        content: string
        source: string
        chunk_type: string
      }>

      return rows.map(r => ({
        id: r.chunk_id,
        content: r.content,
        source: r.source,
        chunkType: r.chunk_type,
        distance: r.distance,
      }))
    } catch (err) {
      console.error(`${BRAND.logPrefix} query failed:`, err)
      return []
    }
  }

  async function ingest(
    chunks: Array<{ content: string; source?: string; chunkType?: string }>,
  ): Promise<{ ingested: number }> {
    let ingested = 0

    const tx = db.transaction(() => {
      for (const chunk of chunks) {
        const vector = embedText(chunk.content)
        const vecBuffer = Buffer.from(vector.buffer)

        const info = insertChunkStmt.run(
          chunk.content,
          chunk.source ?? '',
          chunk.chunkType ?? 'documentation',
          vecBuffer,
        )
        const chunkId = info.lastInsertRowid as number

        insertVecStmt.run(chunkId, vecBuffer)
        ingested++
      }
    })

    tx()
    return { ingested }
  }

  async function clear(): Promise<void> {
    const ids = allChunkIdsStmt.all() as Array<{ id: number }>
    const tx = db.transaction(() => {
      for (const { id } of ids) {
        deleteVecStmt.run(id)
        deleteChunkStmt.run(id)
      }
    })
    tx()
  }

  async function count(): Promise<number> {
    const row = countStmt.get() as { cnt: number }
    return row.cnt
  }

  /**
   * Seed the RAG store from the given project root.
   *
   * Reads flint-manifest.json, .flint/design-tokens.json, and
   * .flint/docs/*.md, then clears existing data and ingests everything.
   *
   * Mirrors electron/ragSeeder.ts — never throws. All errors are logged
   * as warnings and the seeder continues with the remaining sources.
   */
  async function seedFromProject(
    projectRoot: string,
  ): Promise<{ ingested: number; sources: string[] }> {
    const chunks: IngestPayload[] = []
    const sources: string[] = []

    // ── 1. flint-manifest.json — component documentation ──────────────────

    const manifestPath = path.join(projectRoot, BRAND.manifestFile)

    try {
      const raw = await readFile(manifestPath, 'utf-8')
      const manifest: FlintManifest = JSON.parse(raw)
      const components = manifest.components ?? {}
      const entries = Object.values(components)

      if (entries.length > 0) {
        for (const entry of entries) {
          const content = formatComponentChunk(entry)
          if (content.length > 0) {
            chunks.push({
              content,
              source: 'manifest',
              chunkType: 'component',
            })
          }
        }
        sources.push('manifest')
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`${BRAND.logPrefix} flint-manifest.json not found, skipping component chunks`)
      } else {
        console.warn(`${BRAND.logPrefix} Could not read flint-manifest.json:`, err)
      }
    }

    // ── 2. .flint/design-tokens.json — token groups by type ───────────────

    const tokensPath = path.join(projectRoot, BRAND.configDir, 'design-tokens.json')

    try {
      const raw = await readFile(tokensPath, 'utf-8')
      const tokens: DesignToken[] = JSON.parse(raw)

      if (Array.isArray(tokens) && tokens.length > 0) {
        const groups = new Map<string, DesignToken[]>()
        for (const token of tokens) {
          if (
            typeof token.token_path === 'string' &&
            typeof token.token_type === 'string' &&
            typeof token.token_value === 'string'
          ) {
            const group = groups.get(token.token_type) ?? []
            group.push(token)
            groups.set(token.token_type, group)
          }
        }

        for (const [type, group] of groups) {
          const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
          const tokenList = group
            .map(t => `${t.token_path} = ${t.token_value}`)
            .join('\n')
          const content = `Design Tokens — ${typeLabel}:\n${tokenList}`

          chunks.push({
            content,
            source: 'tokens',
            chunkType: 'tokens',
          })
        }

        if (groups.size > 0) {
          sources.push('tokens')
        }
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`${BRAND.logPrefix} .flint/design-tokens.json not found, skipping token chunks`)
      } else {
        console.warn(`${BRAND.logPrefix} Could not read design-tokens.json:`, err)
      }
    }

    // ── 3. .flint/docs/*.md — hand-authored documentation ─────────────────

    const docsDir = path.join(projectRoot, BRAND.configDir, 'docs')

    try {
      const dirEntries = await readdir(docsDir)
      const mdFiles = dirEntries.filter(f => f.endsWith('.md'))

      for (const filename of mdFiles) {
        const filePath = path.join(docsDir, filename)
        try {
          // Symlink guard: skip symlinks to prevent directory traversal
          const stat = await lstat(filePath)
          if (stat.isSymbolicLink()) {
            console.warn(`${BRAND.logPrefix} Skipping symlink: docs/${filename}`)
            continue
          }
          const content = (await readFile(filePath, 'utf-8')).trim()
          if (content.length > 0) {
            chunks.push({
              content,
              source: `docs/${filename}`,
              chunkType: 'documentation',
            })
            sources.push(`docs/${filename}`)
          }
        } catch (err) {
          console.warn(`${BRAND.logPrefix} Could not read docs/${filename}:`, err)
        }
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // .flint/docs/ is optional — silently skip
      } else {
        console.warn(`${BRAND.logPrefix} Could not read .flint/docs/:`, err)
      }
    }

    // ── 4. Ingest ──────────────────────────────────────────────────────────

    if (chunks.length === 0) {
      return { ingested: 0, sources: [] }
    }

    await clear()
    const result = await ingest(chunks)

    console.log(`${BRAND.logPrefix} Seeded: ${result.ingested} chunks from [${sources.join(', ')}]`)

    return { ingested: result.ingested, sources }
  }

  // ── Return service object ────────────────────────────────────────────────

  return {
    query,
    ingest,
    clear,
    count,
    seedFromProject,
  }
}
