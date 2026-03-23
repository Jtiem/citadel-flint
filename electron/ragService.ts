/**
 * ragService.ts — electron/ragService.ts
 *
 * Phase M: Design System RAG pipeline backed by sqlite-vec.
 *
 * Responsibilities:
 *   1. Generates 384-dim embeddings using all-MiniLM-L6-v2 via @huggingface/transformers
 *      (runs 100% offline in the main process — no API key needed).
 *   2. Stores and queries document chunks in the vec_design_system virtual table.
 *   3. Exposes ingestChunks() for bulk loading and queryRAG() for semantic search.
 *
 * The embedding model is lazily loaded on first use (cold-start ~2-5s, warm ~50ms).
 */

import db from './store.js'

// ── Lazy embedding pipeline ─────────────────────────────────────────────────

let pipelinePromise: Promise<EmbeddingPipeline> | null = null

interface EmbeddingPipeline {
    (texts: string[], options?: { pooling: string; normalize: boolean }): Promise<{ tolist: () => number[][] }>
}

async function getEmbedder(): Promise<EmbeddingPipeline> {
    if (!pipelinePromise) {
        pipelinePromise = (async () => {
            // Dynamic import to avoid loading the heavy module at startup
            const { pipeline } = await import('@huggingface/transformers')
            const extractor = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2',
                { dtype: 'fp32' },
            )
            return extractor as unknown as EmbeddingPipeline
        })()
    }
    return pipelinePromise
}

/**
 * Generate a 384-dim embedding for a single text string.
 */
async function embed(text: string): Promise<Float32Array> {
    const extractor = await getEmbedder()
    const result = await extractor([text], { pooling: 'mean', normalize: true })
    const nested = result.tolist()
    return new Float32Array(nested[0])
}

// ── RAG Chunk Types ─────────────────────────────────────────────────────────

export interface RAGChunk {
    id: number
    content: string
    source: string
    chunkType: string
    distance: number
}

export interface IngestPayload {
    content: string
    source?: string
    chunkType?: string
}

// ── Prepared statements ─────────────────────────────────────────────────────

const insertChunkStmt = db.prepare(`
    INSERT INTO rag_chunks (content, source, chunk_type) VALUES (?, ?, ?)
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
    WHERE embedding MATCH ? AND k = ?
    ORDER BY distance
`)

const deleteVecStmt = db.prepare(`DELETE FROM vec_design_system WHERE chunk_id = ?`)
const deleteChunkStmt = db.prepare(`DELETE FROM rag_chunks WHERE id = ?`)
const allChunkIdsStmt = db.prepare(`SELECT id FROM rag_chunks`)

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ingest one or more text chunks into the RAG store.
 * Each chunk is embedded and stored in both rag_chunks (metadata) and
 * vec_design_system (vector index).
 */
export async function ingestChunks(chunks: IngestPayload[]): Promise<{ ingested: number }> {
    let ingested = 0

    for (const chunk of chunks) {
        const vector = await embed(chunk.content)
        const info = insertChunkStmt.run(
            chunk.content,
            chunk.source ?? '',
            chunk.chunkType ?? 'documentation',
        )
        const chunkId = info.lastInsertRowid as number
        // sqlite-vec expects raw bytes for float32 vectors
        insertVecStmt.run(chunkId, Buffer.from(vector.buffer))
        ingested++
    }

    return { ingested }
}

/**
 * Semantic search: embed the query, then find the closest chunks by cosine distance.
 * Returns up to `topK` results sorted by distance (ascending = most similar first).
 */
export async function queryRAG(query: string, topK = 5): Promise<RAGChunk[]> {
    const queryVec = await embed(query)
    const rows = searchStmt.all(
        Buffer.from(queryVec.buffer),
        topK,
    ) as Array<{ chunk_id: number; distance: number; content: string; source: string; chunk_type: string }>

    return rows.map((r) => ({
        id: r.chunk_id,
        content: r.content,
        source: r.source,
        chunkType: r.chunk_type,
        distance: r.distance,
    }))
}

/**
 * Clear all RAG data (chunks + vectors). Used for re-ingestion.
 */
export function clearRAG(): void {
    const ids = allChunkIdsStmt.all() as Array<{ id: number }>
    const tx = db.transaction(() => {
        for (const { id } of ids) {
            deleteVecStmt.run(id)
            deleteChunkStmt.run(id)
        }
    })
    tx()
}

/**
 * Return the current chunk count for diagnostics.
 */
export function ragChunkCount(): number {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks').get() as { cnt: number }
    return row.cnt
}
