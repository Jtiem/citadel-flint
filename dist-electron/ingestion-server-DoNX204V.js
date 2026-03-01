import http from "node:http";
import { BrowserWindow } from "electron";
import db from "./store-TkVicTtR.js";
const PORT = 4545;
const ALLOWED_ORIGIN = "https://www.figma.com";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? "bridge-dev-secret-phase2";
let server = null;
const upsertAsset = db.prepare(
  "INSERT OR REPLACE INTO assets_cache (id, base64_data) VALUES (?, ?)"
);
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
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
function startIngestionServer() {
  if (server) {
    console.warn("[Bridge] Ingestion server already running.");
    return;
  }
  server = http.createServer(handleRequest);
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[Bridge] Ingestion server listening on http://127.0.0.1:${PORT}`);
    console.log(`[Bridge] x-bridge-secret: ${BRIDGE_SECRET}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[Bridge] Port ${PORT} is already in use. Ingestion server not started.`);
    } else {
      console.error("[Bridge] Ingestion server error:", err);
    }
    server = null;
  });
}
function getServerStatus() {
  return {
    running: server !== null && server.listening,
    port: PORT
  };
}
export {
  getServerStatus,
  startIngestionServer
};
