"use strict";
/**
 * vscode-extension/src/bridgeClient.ts
 *
 * Spawns the Bridge MCP server as a child process and communicates via
 * JSON-RPC 2.0 over stdio.
 *
 * Lifecycle:
 *   start(serverPath, projectRoot) -- spawn MCP server
 *   stop()                         -- graceful SIGTERM + SIGKILL fallback
 *   callTool(name, args)           -- JSON-RPC tools/call
 *   isConnected()                  -- connection check
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeClient = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_readline_1 = require("node:readline");
// -- Constants --------------------------------------------------------------
const CALL_TIMEOUT_MS = 30_000;
const SHUTDOWN_GRACE_MS = 5_000;
// -- BridgeClient -----------------------------------------------------------
class BridgeClient {
    proc = null;
    connected = false;
    nextId = 1;
    pendingCalls = new Map();
    onLog;
    constructor(options) {
        this.onLog = options?.onLog ?? (() => { });
    }
    // -- Public API ---------------------------------------------------------
    /**
     * Resolves the MCP server entry point. Checks, in order:
     * 1. Explicit `customServerPath` from settings
     * 2. `<workspaceRoot>/bridge-mcp/dist/server.js`
     * 3. `<workspaceRoot>/node_modules/bridge-mcp/dist/server.js`
     */
    static resolveServerPath(workspaceRoot, customServerPath) {
        if (customServerPath && (0, node_fs_1.existsSync)(customServerPath)) {
            return customServerPath;
        }
        const candidates = [
            node_path_1.default.join(workspaceRoot, 'bridge-mcp', 'dist', 'server.js'),
            node_path_1.default.join(workspaceRoot, 'node_modules', 'bridge-mcp', 'dist', 'server.js'),
        ];
        for (const candidate of candidates) {
            if ((0, node_fs_1.existsSync)(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    /**
     * Spawns the MCP server child process.
     */
    async start(serverPath, projectRoot) {
        if (this.proc !== null) {
            await this.stop();
        }
        if (!(0, node_fs_1.existsSync)(serverPath)) {
            throw new Error(`Bridge MCP server not found at ${serverPath}. ` +
                'Run `npm run build` inside bridge-mcp/ or set bridge.serverPath in settings.');
        }
        const proc = (0, node_child_process_1.spawn)(process.execPath, [serverPath], {
            cwd: projectRoot,
            env: {
                ...process.env,
                BRIDGE_PROJECT_ROOT: projectRoot,
                NO_COLOR: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc = proc;
        this.connected = false;
        const rl = (0, node_readline_1.createInterface)({ input: proc.stdout });
        rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return;
            try {
                const msg = JSON.parse(trimmed);
                this.handleResponse(msg);
            }
            catch {
                // Non-JSON lines -- ignore
            }
        });
        proc.stderr?.on('data', (chunk) => {
            const text = chunk.toString();
            if (!this.connected && text.includes('Bridge MCP Server listening')) {
                this.connected = true;
                this.onLog('Bridge MCP server connected');
            }
        });
        proc.once('error', (err) => {
            this.onLog(`Bridge MCP spawn error: ${err.message}`);
            this.handleExit();
        });
        proc.once('exit', (code, signal) => {
            if (this.proc !== proc)
                return;
            this.onLog(`Bridge MCP server exited (code=${code} signal=${signal})`);
            this.handleExit();
        });
        await this.sendHandshake();
    }
    async stop() {
        if (!this.proc)
            return;
        const proc = this.proc;
        this.proc = null;
        this.connected = false;
        this.rejectAllPending(new Error('Bridge MCP client stopped'));
        await new Promise((resolve) => {
            const killTimer = setTimeout(() => {
                proc.kill('SIGKILL');
                resolve();
            }, SHUTDOWN_GRACE_MS);
            proc.once('exit', () => {
                clearTimeout(killTimer);
                resolve();
            });
            proc.kill('SIGTERM');
        });
    }
    async callTool(name, args) {
        this.assertConnected();
        const result = await this.rpc('tools/call', {
            name,
            arguments: args,
        });
        return result;
    }
    isConnected() {
        return this.connected;
    }
    // -- Internal -----------------------------------------------------------
    async sendHandshake() {
        const handshakeId = this.nextId++;
        const req = {
            jsonrpc: '2.0',
            id: handshakeId,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'bridge-vscode', version: '0.1.0' },
            },
        };
        // Register a pending call so handleResponse can resolve the initialize response
        const initializePromise = new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingCalls.delete(handshakeId);
                resolve(); // Let the fallback timeout handle it
            }, CALL_TIMEOUT_MS);
            this.pendingCalls.set(handshakeId, {
                resolve: () => {
                    if (!this.connected) {
                        this.connected = true;
                        this.onLog('Bridge MCP: connected via initialize response');
                    }
                    resolve();
                },
                reject: () => {
                    resolve(); // Don't fail handshake on RPC error
                },
                timer,
            });
        });
        this.send(req);
        await new Promise((resolve) => {
            // Check both: stderr detection and initialize response
            const check = setInterval(() => {
                if (this.connected) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
            // Also wait for the initialize response
            initializePromise.then(() => {
                if (this.connected) {
                    clearInterval(check);
                    resolve();
                }
            });
            setTimeout(() => {
                clearInterval(check);
                if (!this.connected && this.proc) {
                    this.connected = true;
                    this.onLog('Bridge MCP: assumed connected after handshake settle');
                }
                resolve();
            }, 3000);
        });
    }
    handleResponse(msg) {
        const pending = this.pendingCalls.get(msg.id);
        if (!pending)
            return;
        clearTimeout(pending.timer);
        this.pendingCalls.delete(msg.id);
        if (msg.error) {
            pending.reject(new Error(`MCP RPC error ${msg.error.code}: ${msg.error.message}`));
        }
        else {
            pending.resolve(msg.result);
        }
    }
    handleExit() {
        this.connected = false;
        this.proc = null;
        this.rejectAllPending(new Error('Bridge MCP server process exited unexpectedly'));
    }
    rpc(method, params) {
        const id = this.nextId++;
        const req = { jsonrpc: '2.0', id, method, params };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingCalls.delete(id);
                reject(new Error(`MCP call '${method}' timed out after ${CALL_TIMEOUT_MS}ms`));
            }, CALL_TIMEOUT_MS);
            this.pendingCalls.set(id, { resolve, reject, timer });
            this.send(req);
        });
    }
    send(req) {
        if (!this.proc?.stdin?.writable) {
            this.onLog('Bridge MCP: cannot send -- stdin not writable');
            return;
        }
        const line = JSON.stringify(req) + '\n';
        this.proc.stdin.write(line);
    }
    assertConnected() {
        if (!this.connected) {
            throw new Error('Bridge MCP server is not connected. ' +
                'Ensure bridge-mcp is built and the workspace contains bridge-manifest.json.');
        }
    }
    rejectAllPending(reason) {
        for (const [id, pending] of this.pendingCalls) {
            clearTimeout(pending.timer);
            pending.reject(reason);
            this.pendingCalls.delete(id);
        }
    }
}
exports.BridgeClient = BridgeClient;
//# sourceMappingURL=bridgeClient.js.map