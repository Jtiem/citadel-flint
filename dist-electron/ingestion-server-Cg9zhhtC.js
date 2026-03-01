import http from "node:http";
import { BrowserWindow } from "electron";
import db from "./store-D_TNONCl.js";
const BASE_PORT = 4545;
const MAX_PORT_ATTEMPTS = 10;
const ALLOWED_ORIGIN = "https://www.figma.com";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? "bridge-dev-secret-phase2";
let server = null;
let activePort = BASE_PORT;
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
