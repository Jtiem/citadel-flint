import S from "node:http";
import { BrowserWindow as g } from "electron";
import d from "./store-DuLeHojO.js";
function T(e) {
  if (typeof e != "object" || e === null) return !1;
  const n = e;
  return typeof n.variables == "object" && n.variables !== null && typeof n.variableCollections == "object" && n.variableCollections !== null;
}
function v(e) {
  if (typeof e != "object" || e === null) return !1;
  const n = e;
  return typeof n.r == "number" && typeof n.g == "number" && typeof n.b == "number" && typeof n.a == "number";
}
function A(e) {
  const n = (o) => Math.round(o * 255).toString(16).padStart(2, "0"), r = `#${n(e.r)}${n(e.g)}${n(e.b)}`;
  return e.a < 1 ? r + n(e.a) : r;
}
function k(e) {
  switch (e) {
    case "COLOR":
      return "color";
    case "FLOAT":
      return "dimension";
    case "STRING":
      return "string";
    case "BOOLEAN":
      return "boolean";
  }
}
function _(e, n) {
  return n === "COLOR" ? v(e) ? A(e) : null : n === "FLOAT" ? typeof e == "number" ? String(e) : null : n === "STRING" ? typeof e == "string" ? e : null : n === "BOOLEAN" && typeof e == "boolean" ? String(e) : null;
}
function C(e, n) {
  const r = e.trim().toLowerCase().replace(/\s+/g, "-"), o = n.trim().toLowerCase().replace(/\//g, ".");
  return `${r}.${o}`;
}
function I(e, n) {
  return Array.isArray(n) ? n.find((r) => r.modeId === e)?.name ?? e : e;
}
function w(e) {
  if (!T(e))
    return console.warn("[Bridge] normalizeFigmaVariables: payload failed type guard — skipping"), [];
  const n = [], { variables: r, variableCollections: o } = e;
  for (const t of Object.values(o))
    for (const a of t.variableIds) {
      const i = r[a];
      if (i !== void 0)
        for (const [y, h] of Object.entries(i.valuesByMode)) {
          const u = _(h, i.resolvedType);
          if (u === null) continue;
          const O = I(y, t.modes);
          n.push({
            token_path: C(t.name, i.name),
            token_type: k(i.resolvedType),
            token_value: u,
            mode: O,
            collection_name: t.name,
            ...i.description ? { description: i.description } : {}
          });
        }
    }
  return console.log(
    `[Bridge] normalizeFigmaVariables: produced ${n.length} tokens (${Object.keys(o).length} collections)`
  ), n;
}
const c = 4545, f = 10, p = process.env.BRIDGE_SECRET ?? "bridge-dev-secret-phase2";
let l = null, m = c;
const B = d.prepare(
  "INSERT OR REPLACE INTO assets_cache (id, base64_data) VALUES (?, ?)"
), E = d.prepare(`
    INSERT INTO design_tokens
        (token_path, token_type, token_value, description, mode, collection_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_path, mode, collection_name) DO UPDATE SET
        token_value = excluded.token_value,
        description = excluded.description,
        updated_at  = strftime('%s', 'now')
`), N = d.transaction(
  (e) => {
    for (const n of e)
      E.run(
        n.token_path,
        n.token_type,
        n.token_value,
        n.description ?? null,
        n.mode ?? "default",
        n.collection_name ?? "default"
      );
  }
);
function R(e) {
  e.setHeader("Access-Control-Allow-Origin", "*"), e.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"), e.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bridge-secret"), e.setHeader("Access-Control-Max-Age", "86400");
}
function s(e, n, r) {
  const o = JSON.stringify(r);
  e.writeHead(n, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(o)
  }), e.end(o);
}
function $(e) {
  const n = e.indexOf(",");
  return n !== -1 ? e.slice(n + 1) : e;
}
function L(e, n) {
  if (R(n), e.method === "OPTIONS") {
    n.writeHead(200), n.end();
    return;
  }
  const r = e.headers["x-bridge-secret"];
  if (!r || r !== p) {
    s(n, 401, { error: "Unauthorized: missing or invalid x-bridge-secret" });
    return;
  }
  if (e.method === "POST" && e.url === "/ingest") {
    let o = "";
    e.on("data", (t) => {
      o += t.toString("utf8"), o.length > 10 * 1024 * 1024 && e.destroy();
    }), e.on("end", () => {
      try {
        const t = JSON.parse(o), a = w(t);
        if (a.length === 0) {
          s(n, 400, {
            error: "No tokens produced. Verify the payload contains variables and variableCollections keys."
          });
          return;
        }
        N(a);
        const i = g.getAllWindows();
        i.length > 0 && i[0].webContents.send("bridge:tokens-updated"), console.log(`[Bridge] /ingest: upserted ${a.length} tokens`), s(n, 200, { success: !0, count: a.length });
      } catch {
        s(n, 400, { error: "Invalid JSON payload" });
      }
    }), e.on("error", () => {
      s(n, 500, { error: "Request stream error" });
    });
    return;
  }
  if (e.method === "POST" && e.url === "/ingest-asset") {
    let o = "";
    e.on("data", (t) => {
      o += t.toString("utf8"), o.length > 50 * 1024 * 1024 && e.destroy();
    }), e.on("end", () => {
      try {
        const t = JSON.parse(o);
        if (typeof t.id != "string" || typeof t.imageData != "string") {
          s(n, 400, { error: "Payload must include string fields: id, imageData" });
          return;
        }
        const a = $(t.imageData);
        B.run(t.id, a);
        const i = g.getAllWindows();
        i.length > 0 && i[0].webContents.send("figma-asset-received", { id: t.id }), console.log(`[Bridge] Asset ingested: ${t.id}`), s(n, 200, { success: !0, id: t.id });
      } catch {
        s(n, 400, { error: "Invalid JSON payload" });
      }
    }), e.on("error", () => {
      s(n, 500, { error: "Request stream error" });
    });
    return;
  }
  s(n, 404, { error: `Route not found: ${e.method} ${e.url}` });
}
function b(e) {
  if (e > c + f) {
    console.error(
      `[Bridge] Could not bind to any port in range ${c}–${c + f}. Ingestion server not started.`
    );
    return;
  }
  const n = S.createServer(L);
  n.listen(e, "127.0.0.1", () => {
    l = n, m = e, console.log(`[Bridge] Ingestion server listening on http://127.0.0.1:${e}`), console.log(`[Bridge] x-bridge-secret: ${p}`);
  }), n.on("error", (r) => {
    n.close(), r.code === "EADDRINUSE" ? (console.warn(`[Bridge] Port ${e} in use, trying ${e + 1}…`), b(e + 1)) : console.error("[Bridge] Ingestion server error:", r);
  });
}
function j() {
  if (l) {
    console.warn("[Bridge] Ingestion server already running.");
    return;
  }
  b(c);
}
function F() {
  l && (l.close(() => {
    console.log("[Bridge] Ingestion server stopped.");
  }), l = null);
}
function H() {
  return {
    running: l !== null && l.listening,
    port: m
  };
}
export {
  H as getServerStatus,
  j as startIngestionServer,
  F as stopIngestionServer
};
