/**
 * flint-vscode/src/flintClient.ts
 *
 * Spawns the Flint MCP server as a child process and communicates via
 * JSON-RPC 2.0 over stdio. This mirrors the pattern used by
 * electron/mcpClient.ts but is decoupled from Electron.
 *
 * Lifecycle:
 *   start(serverPath, projectRoot) -- spawn MCP server
 *   stop()                         -- graceful SIGTERM + SIGKILL fallback
 *   callTool(name, args)           -- JSON-RPC tools/call
 *   isConnected()                  -- connection check
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

// -- Types ------------------------------------------------------------------

export interface MCPCallResult {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
}

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: unknown;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

// -- Constants --------------------------------------------------------------

const CALL_TIMEOUT_MS = 30_000;
const SHUTDOWN_GRACE_MS = 5_000;

// -- FlintClient -----------------------------------------------------------

export class FlintClient {
    private proc: ChildProcess | null = null;
    private connected = false;
    private nextId = 1;
    private pendingCalls = new Map<
        number,
        {
            resolve: (value: unknown) => void;
            reject: (reason: Error) => void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();

    private onLog: (msg: string) => void;

    constructor(options?: { onLog?: (msg: string) => void }) {
        this.onLog = options?.onLog ?? (() => {});
    }

    // -- Public API ---------------------------------------------------------

    /**
     * Resolves the MCP server entry point. Checks, in order:
     * 1. Explicit `customServerPath` from settings
     * 2. `<workspaceRoot>/flint-mcp/dist/server.js`
     * 3. `<workspaceRoot>/node_modules/flint-mcp/dist/server.js`
     *
     * Returns the absolute path or null if not found.
     */
    static resolveServerPath(
        workspaceRoot: string,
        customServerPath?: string,
    ): string | null {
        if (customServerPath && existsSync(customServerPath)) {
            return customServerPath;
        }

        const candidates = [
            path.join(workspaceRoot, 'flint-mcp', 'dist', 'server.js'),
            path.join(
                workspaceRoot,
                'node_modules',
                'flint-mcp',
                'dist',
                'server.js',
            ),
        ];

        for (const candidate of candidates) {
            if (existsSync(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Spawns the MCP server child process.
     * @param serverPath Absolute path to flint-mcp/dist/server.js
     * @param projectRoot Workspace root passed as FLINT_PROJECT_ROOT
     */
    async start(serverPath: string, projectRoot: string): Promise<void> {
        if (this.proc !== null) {
            await this.stop();
        }

        if (!existsSync(serverPath)) {
            throw new Error(
                `Flint MCP server not found at ${serverPath}. ` +
                    'Run `npm run build` inside flint-mcp/ or set flint.serverPath in settings.',
            );
        }

        const proc = spawn(process.execPath, [serverPath], {
            cwd: projectRoot,
            env: {
                ...process.env,
                FLINT_PROJECT_ROOT: projectRoot,
                NO_COLOR: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.proc = proc;
        this.connected = false;

        // Read JSON-RPC responses from stdout
        const rl = createInterface({ input: proc.stdout! });
        rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            try {
                const msg = JSON.parse(trimmed) as JsonRpcResponse;
                this.handleResponse(msg);
            } catch {
                // Non-JSON lines -- ignore
            }
        });

        // Detect "connected" signal from stderr
        proc.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            if (!this.connected && text.includes('Flint MCP Server listening')) {
                this.connected = true;
                this.onLog('Flint MCP server connected');
            }
        });

        proc.once('error', (err) => {
            this.onLog(`Flint MCP spawn error: ${err.message}`);
            this.handleExit();
        });

        proc.once('exit', (code, signal) => {
            if (this.proc !== proc) return;
            this.onLog(
                `Flint MCP server exited (code=${code} signal=${signal})`,
            );
            this.handleExit();
        });

        // Send MCP initialize handshake
        await this.sendHandshake();
    }

    async stop(): Promise<void> {
        if (!this.proc) return;
        const proc = this.proc;
        this.proc = null;
        this.connected = false;
        this.rejectAllPending(new Error('Flint MCP client stopped'));

        await new Promise<void>((resolve) => {
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

    async callTool(
        name: string,
        args: Record<string, unknown>,
    ): Promise<MCPCallResult> {
        this.assertConnected();
        const result = await this.rpc('tools/call', {
            name,
            arguments: args,
        });
        return result as MCPCallResult;
    }

    isConnected(): boolean {
        return this.connected;
    }

    // -- Internal -----------------------------------------------------------

    private async sendHandshake(): Promise<void> {
        const req: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: this.nextId++,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'flint-vscode', version: '0.1.0' },
            },
        };
        this.send(req);

        // Fallback: assume connected after settle period
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (this.connected) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);

            setTimeout(() => {
                clearInterval(check);
                if (!this.connected && this.proc) {
                    this.connected = true;
                    this.onLog(
                        'Flint MCP: assumed connected after handshake settle',
                    );
                }
                resolve();
            }, 3000);
        });
    }

    private handleResponse(msg: JsonRpcResponse): void {
        const pending = this.pendingCalls.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pendingCalls.delete(msg.id);

        if (msg.error) {
            pending.reject(
                new Error(
                    `MCP RPC error ${msg.error.code}: ${msg.error.message}`,
                ),
            );
        } else {
            pending.resolve(msg.result);
        }
    }

    private handleExit(): void {
        this.connected = false;
        this.proc = null;
        this.rejectAllPending(
            new Error('Flint MCP server process exited unexpectedly'),
        );
    }

    private rpc(method: string, params: unknown): Promise<unknown> {
        const id = this.nextId++;
        const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

        return new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingCalls.delete(id);
                reject(
                    new Error(
                        `MCP call '${method}' timed out after ${CALL_TIMEOUT_MS}ms`,
                    ),
                );
            }, CALL_TIMEOUT_MS);

            this.pendingCalls.set(id, { resolve, reject, timer });
            this.send(req);
        });
    }

    private send(req: JsonRpcRequest): void {
        if (!this.proc?.stdin?.writable) {
            this.onLog('Flint MCP: cannot send -- stdin not writable');
            return;
        }
        const line = JSON.stringify(req) + '\n';
        this.proc.stdin.write(line);
    }

    private assertConnected(): void {
        if (!this.connected) {
            throw new Error(
                'Flint MCP server is not connected. ' +
                    'Ensure flint-mcp is built and the workspace contains flint-manifest.json.',
            );
        }
    }

    private rejectAllPending(reason: Error): void {
        for (const [id, pending] of this.pendingCalls) {
            clearTimeout(pending.timer);
            pending.reject(reason);
            this.pendingCalls.delete(id);
        }
    }
}
