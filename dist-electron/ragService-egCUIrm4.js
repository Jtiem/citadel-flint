import db from "./store-BKAt7koo.js";
let pipelinePromise = null;
async function getEmbedder() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("./transformers.node-DdNjsqTx.js");
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { dtype: "fp32" }
      );
      return extractor;
    })();
  }
  return pipelinePromise;
}
async function embed(text) {
  const extractor = await getEmbedder();
  const result = await extractor([text], { pooling: "mean", normalize: true });
  const nested = result.tolist();
  return new Float32Array(nested[0]);
}
const insertChunkStmt = db.prepare(`
    INSERT INTO rag_chunks (content, source, chunk_type) VALUES (?, ?, ?)
`);
const insertVecStmt = db.prepare(`
    INSERT INTO vec_design_system (chunk_id, embedding) VALUES (?, ?)
`);
const searchStmt = db.prepare(`
    SELECT
        v.chunk_id,
        v.distance,
        r.content,
        r.source,
        r.chunk_type
    FROM vec_design_system v
    JOIN rag_chunks r ON r.id = v.chunk_id
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
`);
const deleteVecStmt = db.prepare(`DELETE FROM vec_design_system WHERE chunk_id = ?`);
const deleteChunkStmt = db.prepare(`DELETE FROM rag_chunks WHERE id = ?`);
const allChunkIdsStmt = db.prepare(`SELECT id FROM rag_chunks`);
async function ingestChunks(chunks) {
  let ingested = 0;
  for (const chunk of chunks) {
    const vector = await embed(chunk.content);
    const info = insertChunkStmt.run(
      chunk.content,
      chunk.source ?? "",
      chunk.chunkType ?? "documentation"
    );
    const chunkId = info.lastInsertRowid;
    insertVecStmt.run(chunkId, Buffer.from(vector.buffer));
    ingested++;
  }
  return { ingested };
}
async function queryRAG(query, topK = 5) {
  const queryVec = await embed(query);
  const rows = searchStmt.all(
    Buffer.from(queryVec.buffer),
    topK
  );
  return rows.map((r) => ({
    id: r.chunk_id,
    content: r.content,
    source: r.source,
    chunkType: r.chunk_type,
    distance: r.distance
  }));
}
function clearRAG() {
  const ids = allChunkIdsStmt.all();
  const tx = db.transaction(() => {
    for (const { id } of ids) {
      deleteVecStmt.run(id);
      deleteChunkStmt.run(id);
    }
  });
  tx();
}
function ragChunkCount() {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM rag_chunks").get();
  return row.cnt;
}
export {
  clearRAG,
  ingestChunks,
  queryRAG,
  ragChunkCount
};
