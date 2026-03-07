import e from "./store-DuLeHojO.js";
let s = null;
async function i() {
  return s || (s = (async () => {
    const { pipeline: t } = await import("./transformers.node-C5W0E39u.js");
    return await t(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { dtype: "fp32" }
    );
  })()), s;
}
async function a(t) {
  const o = (await (await i())([t], { pooling: "mean", normalize: !0 })).tolist();
  return new Float32Array(o[0]);
}
const d = e.prepare(`
    INSERT INTO rag_chunks (content, source, chunk_type) VALUES (?, ?, ?)
`), p = e.prepare(`
    INSERT INTO vec_design_system (chunk_id, embedding) VALUES (?, ?)
`), f = e.prepare(`
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
`), l = e.prepare("DELETE FROM vec_design_system WHERE chunk_id = ?"), E = e.prepare("DELETE FROM rag_chunks WHERE id = ?"), h = e.prepare("SELECT id FROM rag_chunks");
async function k(t) {
  let r = 0;
  for (const n of t) {
    const o = await a(n.content), u = d.run(
      n.content,
      n.source ?? "",
      n.chunkType ?? "documentation"
    ).lastInsertRowid;
    p.run(u, Buffer.from(o.buffer)), r++;
  }
  return { ingested: r };
}
async function _(t, r = 5) {
  const n = await a(t);
  return f.all(
    Buffer.from(n.buffer),
    r
  ).map((c) => ({
    id: c.chunk_id,
    content: c.content,
    source: c.source,
    chunkType: c.chunk_type,
    distance: c.distance
  }));
}
function y() {
  const t = h.all();
  e.transaction(() => {
    for (const { id: n } of t)
      l.run(n), E.run(n);
  })();
}
function g() {
  return e.prepare("SELECT COUNT(*) as cnt FROM rag_chunks").get().cnt;
}
export {
  y as clearRAG,
  k as ingestChunks,
  _ as queryRAG,
  g as ragChunkCount
};
