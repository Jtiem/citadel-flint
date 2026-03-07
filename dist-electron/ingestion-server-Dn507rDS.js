import http from "node:http";
import { BrowserWindow } from "electron";
import db from "./store-ckv2SHZn.js";
function isFigmaVariablesPayload(p) {
  if (typeof p !== "object" || p === null) return false;
  const obj = p;
  return typeof obj.variables === "object" && obj.variables !== null && typeof obj.variableCollections === "object" && obj.variableCollections !== null;
}
function isFigmaRGBA(v) {
  if (typeof v !== "object" || v === null) return false;
  const c = v;
  return typeof c.r === "number" && typeof c.g === "number" && typeof c.b === "number" && typeof c.a === "number";
}
function rgbaToHex(c) {
  const ch = (n) => Math.round(n * 255).toString(16).padStart(2, "0");
  const hex = `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
  return c.a < 1 ? hex + ch(c.a) : hex;
}
function mapFigmaType(t) {
  switch (t) {
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
function serializeValue(value, type) {
  if (type === "COLOR") return isFigmaRGBA(value) ? rgbaToHex(value) : null;
  if (type === "FLOAT") return typeof value === "number" ? String(value) : null;
  if (type === "STRING") return typeof value === "string" ? value : null;
  if (type === "BOOLEAN") return typeof value === "boolean" ? String(value) : null;
  return null;
}
function buildTokenPath(collectionName, variableName) {
  const collection = collectionName.trim().toLowerCase().replace(/\s+/g, "-");
  const variable = variableName.trim().toLowerCase().replace(/\//g, ".");
  return `${collection}.${variable}`;
}
function resolveModeNme(modeId, modes) {
  if (!Array.isArray(modes)) return modeId;
  return modes.find((m) => m.modeId === modeId)?.name ?? modeId;
}
function normalizeFigmaVariables(figmaPayload) {
  if (!isFigmaVariablesPayload(figmaPayload)) {
    console.warn("[Bridge] normalizeFigmaVariables: payload failed type guard — skipping");
    return [];
  }
  const tokens = [];
  const { variables, variableCollections } = figmaPayload;
  for (const collection of Object.values(variableCollections)) {
    for (const variableId of collection.variableIds) {
      const variable = variables[variableId];
      if (variable === void 0) continue;
      for (const [modeId, rawValue] of Object.entries(variable.valuesByMode)) {
        const token_value = serializeValue(rawValue, variable.resolvedType);
        if (token_value === null) continue;
        const mode = resolveModeNme(modeId, collection.modes);
        tokens.push({
          token_path: buildTokenPath(collection.name, variable.name),
          token_type: mapFigmaType(variable.resolvedType),
          token_value,
          mode,
          collection_name: collection.name,
          ...variable.description ? { description: variable.description } : {}
        });
      }
    }
  }
  console.log(
    `[Bridge] normalizeFigmaVariables: produced ${tokens.length} tokens (${Object.keys(variableCollections).length} collections)`
  );
  return tokens;
}
const BASE_PORT = 4545;
const MAX_PORT_ATTEMPTS = 10;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? "bridge-dev-secret-phase2";
let server = null;
let activePort = BASE_PORT;
const upsertAsset = db.prepare(
  "INSERT OR REPLACE INTO assets_cache (id, base64_data) VALUES (?, ?)"
);
const upsertToken = db.prepare(`
    INSERT INTO design_tokens
        (token_path, token_type, token_value, description, mode, collection_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_path, mode, collection_name) DO UPDATE SET
        token_value = excluded.token_value,
        description = excluded.description,
        updated_at  = strftime('%s', 'now')
`);
const batchUpsertTokens = db.transaction(
  (tokens) => {
    for (const t of tokens) {
      upsertToken.run(
        t.token_path,
        t.token_type,
        t.token_value,
        t.description ?? null,
        t.mode ?? "default",
        t.collection_name ?? "default"
      );
    }
  }
);
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bridge-secret");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}
function normaliseBase64(raw) {
  const commaIndex = raw.indexOf(",");
  return commaIndex !== -1 ? raw.slice(commaIndex + 1) : raw;
}
function handleRequest(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  const secret = req.headers["x-bridge-secret"];
  if (!secret || secret !== BRIDGE_SECRET) {
    sendJson(res, 401, { error: "Unauthorized: missing or invalid x-bridge-secret" });
    return;
  }
  if (req.method === "POST" && req.url === "/ingest") {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk.toString("utf8");
      if (rawBody.length > 10 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(rawBody);
        const tokens = normalizeFigmaVariables(payload);
        if (tokens.length === 0) {
          sendJson(res, 400, {
            error: "No tokens produced. Verify the payload contains variables and variableCollections keys."
          });
          return;
        }
        batchUpsertTokens(tokens);
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send("bridge:tokens-updated");
        }
        console.log(`[Bridge] /ingest: upserted ${tokens.length} tokens`);
        sendJson(res, 200, { success: true, count: tokens.length });
      } catch {
        sendJson(res, 400, { error: "Invalid JSON payload" });
      }
    });
    req.on("error", () => {
      sendJson(res, 500, { error: "Request stream error" });
    });
    return;
  }
  if (req.method === "POST" && req.url === "/ingest-asset") {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk.toString("utf8");
      if (rawBody.length > 50 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(rawBody);
        if (typeof payload.id !== "string" || typeof payload.imageData !== "string") {
          sendJson(res, 400, { error: "Payload must include string fields: id, imageData" });
          return;
        }
        const base64Data = normaliseBase64(payload.imageData);
        upsertAsset.run(payload.id, base64Data);
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send("figma-asset-received", { id: payload.id });
        }
        console.log(`[Bridge] Asset ingested: ${payload.id}`);
        sendJson(res, 200, { success: true, id: payload.id });
      } catch {
        sendJson(res, 400, { error: "Invalid JSON payload" });
      }
    });
    req.on("error", () => {
      sendJson(res, 500, { error: "Request stream error" });
    });
    return;
  }
  sendJson(res, 404, { error: `Route not found: ${req.method} ${req.url}` });
}
function tryListen(port) {
  if (port > BASE_PORT + MAX_PORT_ATTEMPTS) {
    console.error(
      `[Bridge] Could not bind to any port in range ${BASE_PORT}–${BASE_PORT + MAX_PORT_ATTEMPTS}. Ingestion server not started.`
    );
    return;
  }
  const attempt = http.createServer(handleRequest);
  attempt.listen(port, "127.0.0.1", () => {
    server = attempt;
    activePort = port;
    console.log(`[Bridge] Ingestion server listening on http://127.0.0.1:${port}`);
    console.log(`[Bridge] x-bridge-secret: ${BRIDGE_SECRET}`);
  });
  attempt.on("error", (err) => {
    attempt.close();
    if (err.code === "EADDRINUSE") {
      console.warn(`[Bridge] Port ${port} in use, trying ${port + 1}…`);
      tryListen(port + 1);
    } else {
      console.error("[Bridge] Ingestion server error:", err);
    }
  });
}
function startIngestionServer() {
  if (server) {
    console.warn("[Bridge] Ingestion server already running.");
    return;
  }
  tryListen(BASE_PORT);
}
function stopIngestionServer() {
  if (server) {
    server.close(() => {
      console.log("[Bridge] Ingestion server stopped.");
    });
    server = null;
  }
}
function getServerStatus() {
  return {
    running: server !== null && server.listening,
    port: activePort
  };
}
export {
  getServerStatus,
  startIngestionServer,
  stopIngestionServer
};
